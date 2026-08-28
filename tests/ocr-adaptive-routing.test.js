import test from 'node:test';
import assert from 'node:assert/strict';
import {OcrEngine} from '../core/ocr/ocr-engine.js';
import {OcrEnginePerformanceStore,LocalStorageOcrEnginePerformanceStore} from '../core/ocr/ocr-engine-performance.js';
import {routeOcrEngines,estimateReceiptDifficulty} from '../core/ocr/ocr-adaptive-router.js';
import {runOcrEnsemble} from '../core/ocr/ocr-ensemble.js';

class E extends OcrEngine{
  constructor(id,output,{priority=50,latency=0}={}){
    super(id,{priority,languages:['spa','eng'],capabilities:{text:true,bboxes:id==='paddle',orientation:id==='paddle'}});
    this.output=output;this.calls=0;this.latency=latency;
  }
  async recognize(){
    this.calls++;
    if(this.output instanceof Error)throw this.output;
    return this.normalize({engineId:this.id,text:this.output.text,confidence:this.output.confidence});
  }
}
const C=id=>({blob:{id},planId:id,selectedPlan:{id}});

test('easy clean image routes primary with fallback and early-stop budget',()=>{
  const paddle=new E('paddle',{text:'TOTAL 10.00',confidence:.9},{priority:80});
  const tess=new E('tess',{text:'TOTAL 10.00',confidence:.8},{priority:50});
  const r=routeOcrEngines({engines:[paddle,tess],quality:{score:.9,flags:[]},performanceStore:new OcrEnginePerformanceStore()});
  assert.equal(r.difficulty.level,'easy');
  assert.equal(r.strategy,'primary-with-fallback');
  assert.equal(r.budget.maxEngines,2);
  assert.ok(Number.isFinite(r.budget.earlyStopScore));
});

test('hard image requests dual competition rather than early stop',()=>{
  const engines=[new E('paddle',{text:'x',confidence:.8},{priority:80}),new E('tess',{text:'x',confidence:.8})];
  const r=routeOcrEngines({engines,quality:{score:.3,flags:['low_contrast','blurry_or_low_detail']}});
  assert.equal(r.difficulty.level,'hard');
  assert.equal(r.strategy,'dual-competition');
  assert.equal(r.budget.earlyStopScore,null);
  assert.equal(r.budget.maxEngines,2);
});

test('historically reliable faster engine can outrank nominal priority',()=>{
  const highPriority=new E('paddle',{text:'x',confidence:.8},{priority:90});
  const stable=new E('tess',{text:'x',confidence:.8},{priority:50});
  const perf=new OcrEnginePerformanceStore({
    paddle:{attempts:10,successes:4,failures:6,avgLatencyMs:5000,avgEvidenceScore:55,consecutiveFailures:2},
    tess:{attempts:10,successes:9,failures:1,avgLatencyMs:800,avgEvidenceScore:88,consecutiveFailures:0},
  });
  const r=routeOcrEngines({engines:[highPriority,stable],quality:{score:.8,flags:[]},performanceStore:perf});
  assert.equal(r.engines[0].id,'tess');
});

test('performance store tracks success failure latency evidence score',()=>{
  const s=new OcrEnginePerformanceStore();
  s.recordSuccess('a',{latencyMs:1000,score:90});
  s.recordSuccess('a',{latencyMs:500,score:80});
  s.recordFailure('a');
  const x=s.publicStats('a');
  assert.equal(x.attempts,3);
  assert.equal(x.successes,2);
  assert.equal(x.failures,1);
  assert.equal(x.avgLatencyMs,750);
  assert.equal(x.avgEvidenceScore,85);
  assert.equal(x.consecutiveFailures,1);
});

test('easy strong primary result stops before fallback engine executes',async()=>{
  const primary=new E('paddle',{text:'FECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00',confidence:.95},{priority:80});
  const fallback=new E('tess',{text:'TOTAL 999.99',confidence:.9},{priority:50});
  const perf=new OcrEnginePerformanceStore();
  const route=routeOcrEngines({engines:[primary,fallback],quality:{score:.9,flags:[]},performanceStore:perf});
  const r=await runOcrEnsemble({
    candidates:[C('a')],
    engines:route.engines,
    maxEngines:route.budget.maxEngines,
    maxPassesPerEngine:route.budget.maxPassesPerEngine,
    maxTotalRecognitions:route.budget.maxTotalRecognitions,
    earlyStopScore:route.budget.earlyStopScore,
    performanceStore:perf,
  });
  assert.equal(r.selectedEngineId,'paddle');
  assert.equal(primary.calls,1);
  assert.equal(fallback.calls,0);
});

test('primary failure automatically executes fallback and updates performance',async()=>{
  const err=new Error('PADDLE_OCR_UNAVAILABLE');err.code='PADDLE_OCR_UNAVAILABLE';
  const primary=new E('paddle',err,{priority:80});
  const fallback=new E('tess',{text:'FECHA 20/08/2026\nTOTAL 10.00',confidence:.8},{priority:50});
  const perf=new OcrEnginePerformanceStore();
  const r=await runOcrEnsemble({
    candidates:[C('a')],
    engines:[primary,fallback],
    maxEngines:2,maxPassesPerEngine:1,maxTotalRecognitions:2,
    earlyStopScore:78,performanceStore:perf,
  });
  assert.equal(r.selectedEngineId,'tess');
  assert.equal(primary.calls,1);
  assert.equal(fallback.calls,1);
  assert.equal(perf.publicStats('paddle').failures,1);
  assert.equal(perf.publicStats('tess').successes,1);
});

test('low power hard image keeps a strict two-recognition budget',()=>{
  const engines=[new E('paddle',{text:'x',confidence:.8},{priority:80}),new E('tess',{text:'x',confidence:.8})];
  const r=routeOcrEngines({engines,quality:{score:.25,flags:['low_contrast','blurry_or_low_detail']},deviceClass:'low_power'});
  assert.equal(r.budget.maxTotalRecognitions,2);
  assert.equal(r.budget.maxPassesPerEngine,1);
});

test('difficulty estimator is deterministic from quality flags',()=>{
  assert.equal(estimateReceiptDifficulty({score:.9,flags:[]}).level,'easy');
  assert.equal(estimateReceiptDifficulty({score:.6,flags:['low_contrast']}).level,'medium');
  assert.equal(estimateReceiptDifficulty({score:.3,flags:['low_contrast','blurry_or_low_detail']}).level,'hard');
});


test('routing success rate is conservatively smoothed for small samples',()=>{
  const s=new OcrEnginePerformanceStore();
  s.recordFailure('paddle');
  const x=s.publicStats('paddle');
  assert.equal(x.successRate,0);
  assert.ok(x.routingSuccessRate>0.5);
});

test('localStorage performance store persists only aggregate engine metrics',()=>{
  const mem=new Map();
  const storage={
    getItem:k=>mem.get(k)??null,
    setItem:(k,v)=>mem.set(k,v),
    removeItem:k=>mem.delete(k),
  };
  const a=new LocalStorageOcrEnginePerformanceStore({storage,key:'x'});
  a.recordSuccess('paddle',{latencyMs:900,score:88});
  const raw=mem.get('x');
  assert.ok(raw.includes('avgLatencyMs'));
  assert.equal(/TOTAL|OCR TEXT|imageBase64/i.test(raw),false);
  const b=new LocalStorageOcrEnginePerformanceStore({storage,key:'x'});
  assert.equal(b.publicStats('paddle').successes,1);
  assert.equal(b.publicStats('paddle').avgEvidenceScore,88);
});

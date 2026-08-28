import test from 'node:test';
import assert from 'node:assert/strict';
import {runOcrEnsemble} from '../core/ocr/ocr-ensemble.js';

const candidate={planId:'fast',ocrInput:{},release(){}};
const normalized={engineId:'slow',engineVersion:'1',providerType:'local',text:'',confidence:0,blocks:[],languages:['eng'],capabilities:{}};

test('OCR ensemble enforces critical-path budget above slow vendor timeout',async()=>{
  const slow={id:'slow',version:'1',providerType:'local',priority:1,recognize:()=>new Promise(r=>setTimeout(()=>r(normalized),500))};
  const started=Date.now();
  await assert.rejects(()=>runOcrEnsemble({candidates:[candidate],engines:[slow],maxEngines:1,maxPassesPerEngine:1,maxTotalRecognitions:1,totalBudgetMs:60}),/ALL_OCR_ENGINES_FAILED/);
  assert.ok(Date.now()-started<300,'critical path must not inherit the slow engine deadline');
});

test('OCR ensemble still returns fast result inside critical-path budget',async()=>{
  const fast={id:'fast',version:'1',providerType:'local',priority:1,recognize:async()=>({...normalized,engineId:'fast',text:'TOTAL 108.00',confidence:.95})};
  const result=await runOcrEnsemble({candidates:[candidate],engines:[fast],maxEngines:1,maxPassesPerEngine:1,maxTotalRecognitions:1,totalBudgetMs:500});
  assert.equal(result.selectedEngineId,'fast');
  assert.equal(result.totalRecognitions,1);
});

test('multi-pass OCR exposes materialize recognition and postprocess timings',async()=>{
  const {runMultiPassOcr}=await import('../core/ocr/multi-pass-ocr.js');
  const candidate={planId:'base',ocrInput:{},release(){}};
  const engine={id:'timed',providerType:'local',async recognize(){await new Promise(r=>setTimeout(r,8));return {engineId:'timed',confidence:.9,text:'TOTAL 10.00'}}};
  const run=await runMultiPassOcr({candidates:[candidate],ocrEngine:engine,maxPasses:1});
  assert.equal(typeof run.stageTimings.materialize,'number');
  assert.ok(run.stageTimings.recognition>=5);
  assert.equal(typeof run.stageTimings.postprocess,'number');
});

test('OCR ensemble aggregates measured inner-stage timings',async()=>{
  const {runOcrEnsemble}=await import('../core/ocr/ocr-ensemble.js');
  const engine={id:'timed-ensemble',providerType:'local',async recognize(){await new Promise(r=>setTimeout(r,6));return {engineId:'timed-ensemble',confidence:.9,text:'TOTAL 10.00'}}};
  const out=await runOcrEnsemble({candidates:[{planId:'base',ocrInput:{}}],engines:[engine],maxPassesPerEngine:1});
  assert.ok(out.stageTimings.recognition>=4);
  assert.equal(typeof out.stageTimings.postprocess,'number');
});

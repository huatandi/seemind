import test from 'node:test';
import assert from 'node:assert/strict';
import {OcrBenchmarkDataset,runOcrBenchmark,scoreOcrBenchmarkCase,compareOcrStrategies} from '../core/evaluation/ocr-benchmark.js';
import {createOcrPromotionCandidate,recordOcrPromotionRegression,approveOcrPromotion} from '../core/evaluation/ocr-promotion-gate.js';

const caseA={
  id:'r1',difficulty:'easy',receiptType:'supermarket',
  expected:{date:{value:'2026-08-20'},total:{value:10800},subtotal:{value:10000},tax:{value:800}},
  criticalFields:['date','total']
};

test('OCR benchmark dataset rejects duplicate IDs',()=>{
  assert.throws(()=>new OcrBenchmarkDataset([caseA,caseA]),/DUPLICATE_OCR_BENCHMARK_CASE/);
});

test('OCR benchmark case scoring tracks field and critical accuracy',()=>{
  const s=scoreOcrBenchmarkCase(caseA,{
    receipt:{date:{value:'2026-08-20'},total:{value:10800},subtotal:{value:10000},tax:{value:700}}
  });
  assert.equal(s.fieldAccuracy,.75);
  assert.equal(s.criticalAccuracy,1);
  assert.equal(s.totalCorrect,true);
  assert.equal(s.dateCorrect,true);
  assert.equal(s.exactCasePass,false);
});

test('benchmark compares multiple OCR strategies on identical cases',async()=>{
  const ds=new OcrBenchmarkDataset([
    caseA,
    {...caseA,id:'r2',difficulty:'hard',receiptType:'supermarket'},
  ]);
  const report=await runOcrBenchmark({
    dataset:ds,
    strategies:{
      paddle:async()=>({receipt:caseA.expected,evidenceScore:90,recognitions:1}),
      tesseract:async({golden})=>({receipt:{...golden.expected,total:{value:99999}},evidenceScore:70,recognitions:2,fallbackUsed:false}),
    }
  });
  assert.equal(report.caseCount,2);
  assert.equal(report.aggregate.paddle.fieldAccuracy,1);
  assert.ok(report.aggregate.tesseract.fieldAccuracy<1);
  assert.equal(report.aggregate.paddle.totalAccuracy,1);
});

test('benchmark records strategy failure without aborting other strategies',async()=>{
  const ds=new OcrBenchmarkDataset([caseA]);
  const e=new Error('PADDLE_OCR_UNAVAILABLE');e.code='PADDLE_OCR_UNAVAILABLE';
  const report=await runOcrBenchmark({
    dataset:ds,
    strategies:{
      paddle:async()=>{throw e},
      tess:async()=>({receipt:caseA.expected}),
    }
  });
  assert.equal(report.aggregate.paddle.failureRate,1);
  assert.equal(report.aggregate.tess.failureRate,0);
});

test('strategy comparison requires enough benchmark cases before recommendation',async()=>{
  const ds=new OcrBenchmarkDataset([caseA]);
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected}),b:async()=>({receipt:caseA.expected})}});
  const c=compareOcrStrategies(report,{minimumCases:5});
  assert.equal(c.recommendation.status,'insufficient_data');
});

test('strategy comparison can recommend benchmark leader but not auto-promote',async()=>{
  const cases=Array.from({length:6},(_,i)=>({...caseA,id:`r${i}`,difficulty:'easy',receiptType:'supermarket'}));
  const ds=new OcrBenchmarkDataset(cases);
  const report=await runOcrBenchmark({
    dataset:ds,
    strategies:{
      paddle:async()=>({receipt:caseA.expected}),
      tess:async()=>({receipt:{...caseA.expected,total:{value:99999}}}),
    }
  });
  const comparison=compareOcrStrategies(report,{minimumCases:5});
  assert.equal(comparison.recommendation.status,'candidate');
  assert.equal(comparison.recommendation.strategyId,'paddle');
  const candidate=createOcrPromotionCandidate({benchmarkComparison:comparison});
  assert.equal(candidate.status,'proposed');
  assert.equal(candidate.approved,false);
});

test('OCR promotion requires regression then explicit approval',async()=>{
  const cases=Array.from({length:5},(_,i)=>({...caseA,id:`x${i}`}));
  const ds=new OcrBenchmarkDataset(cases);
  const report=await runOcrBenchmark({dataset:ds,strategies:{paddle:async()=>({receipt:caseA.expected})}});
  const comparison=compareOcrStrategies(report,{minimumCases:5});
  let c=createOcrPromotionCandidate({benchmarkComparison:comparison});
  c=recordOcrPromotionRegression(c,{passed:true,criticalRegressions:[]});
  assert.equal(c.status,'regression_passed');
  c=approveOcrPromotion(c,{approved:true,approvedBy:'human-review'});
  assert.equal(c.status,'promoted');
});

test('critical regression rejects OCR promotion candidate',async()=>{
  const cases=Array.from({length:5},(_,i)=>({...caseA,id:`z${i}`}));
  const ds=new OcrBenchmarkDataset(cases);
  const report=await runOcrBenchmark({dataset:ds,strategies:{paddle:async()=>({receipt:caseA.expected})}});
  const comparison=compareOcrStrategies(report,{minimumCases:5});
  const c=createOcrPromotionCandidate({benchmarkComparison:comparison});
  const rejected=recordOcrPromotionRegression(c,{passed:false,criticalRegressions:['receipt-no-total-no-guess']});
  assert.equal(rejected.status,'rejected');
});


test('case loader failure is recorded without aborting the benchmark',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'r2'}]);
  const report=await runOcrBenchmark({dataset:ds,caseLoader:async g=>{if(g.id==='r1'){const e=new Error('IMAGE_READ_FAILED');e.code='IMAGE_READ_FAILED';throw e}return g.image},strategies:{a:async()=>({receipt:caseA.expected})}});
  assert.equal(report.caseCount,2);
  assert.equal(report.results.find(x=>x.caseId==='r1').failureCode,'IMAGE_READ_FAILED');
  assert.equal(report.results.find(x=>x.caseId==='r2').failed,false);
});


test('hung benchmark strategy is bounded by a per-run timeout',async()=>{
  const ds=new OcrBenchmarkDataset([caseA]);
  const report=await runOcrBenchmark({dataset:ds,strategyTimeoutMs:20,strategies:{hung:async()=>new Promise(()=>{}),fast:async()=>({receipt:caseA.expected})}});
  assert.equal(report.results.find(x=>x.strategyId==='hung').failureCode,'OCR_BENCHMARK_STRATEGY_TIMEOUT');
  assert.equal(report.results.find(x=>x.strategyId==='fast').failed,false);
});


test('benchmark latency keeps sub-millisecond precision for fast-path analysis',async()=>{
  const ds=new OcrBenchmarkDataset([caseA]);
  const report=await runOcrBenchmark({dataset:ds,strategies:{fast:async()=>({receipt:caseA.expected})}});
  assert.equal(typeof report.results[0].elapsedMs,'number');
  assert.ok(report.results[0].elapsedMs>=0);
  assert.ok(Number.isFinite(report.results[0].elapsedMs));
});


test('benchmark reports p50 and p95 latency so tail stalls are visible',async()=>{
  const cases=Array.from({length:5},(_,i)=>({...caseA,id:`lat-${i}`}));
  const ds=new OcrBenchmarkDataset(cases);
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected})}});
  assert.ok(Number.isFinite(report.aggregate.a.p50LatencyMs));
  assert.ok(Number.isFinite(report.aggregate.a.p95LatencyMs));
  assert.ok(report.aggregate.a.p95LatencyMs>=report.aggregate.a.p50LatencyMs);
});


test('strategy ranking penalizes severe p95 tail stalls instead of hiding them in averages',()=>{
  const rows=[];
  for(let i=0;i<5;i++){
    const base={caseId:`p${i}`,difficulty:'easy',receiptType:'doc',failed:false,fieldAccuracy:1,criticalAccuracy:1,totalCorrect:true,dateCorrect:true,fallbackUsed:false,recognitions:1};
    rows.push({...base,strategyId:'stable',elapsedMs:1000});
    rows.push({...base,strategyId:'spiky',elapsedMs:i===4?9000:0});
  }
  const comparison=compareOcrStrategies({results:rows},{minimumCases:5});
  assert.equal(comparison.overallRanking[0].strategyId,'stable');
  assert.ok(comparison.overallRanking.find(x=>x.strategyId==='spiky').metrics.p95LatencyMs>comparison.overallRanking.find(x=>x.strategyId==='stable').metrics.p95LatencyMs);
});


test('hung case loader is bounded and cannot freeze the benchmark',async()=>{
  const ds=new OcrBenchmarkDataset([caseA]);
  const report=await runOcrBenchmark({dataset:ds,caseLoaderTimeoutMs:20,caseLoader:async()=>new Promise(()=>{}),strategies:{a:async()=>({receipt:caseA.expected})}});
  assert.equal(report.results[0].failureCode,'OCR_BENCHMARK_CASE_LOADER_TIMEOUT');
});


test('benchmark aggregates stage timings to expose the real latency head',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'stage-2'}]);
  let n=0;
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,stageTimings:{decode:++n*10,recognition:n*100}})}});
  assert.equal(report.aggregate.a.stageTimings.decode.p95Ms,20);
  assert.equal(report.aggregate.a.stageTimings.recognition.p95Ms,200);
});


test('benchmark tracks first useful latency separately from final completion',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'fu-2'}]);
  let n=0;
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,firstUsefulMs:++n*120})}});
  assert.equal(report.aggregate.a.p50FirstUsefulMs,120);
  assert.equal(report.aggregate.a.p95FirstUsefulMs,240);
});


test('benchmark separates cold-start and warm-path latency',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'warm-2'}]);
  let n=0;
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,coldStart:++n===1})}});
  assert.equal(typeof report.aggregate.a.coldStartAvgLatencyMs,'number');
  assert.equal(typeof report.aggregate.a.warmAvgLatencyMs,'number');
});


test('benchmark identifies the largest p95 stage as the latency head',async()=>{
  const ds=new OcrBenchmarkDataset([caseA]);
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,stageTimings:{decode:20,preprocess:80,recognition:900,fusion:30}})}});
  assert.equal(report.aggregate.a.latencyHead,'recognition');
});

test('benchmark infers cold and hot path from OCR worker diagnostics',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'diag-hot'}]);
  let n=0;
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,diagnostics:++n===1?{workerCreated:true,workerCacheHit:false}:{workerCreated:false,workerCacheHit:true}})}});
  assert.equal(report.aggregate.a.coldSamples,1);
  assert.equal(report.aggregate.a.warmSamples,1);
  assert.equal(report.aggregate.a.workerCacheHitRate,.5);
  assert.equal(report.aggregate.a.workerCreationRate,.5);
});

test('benchmark exposes cold/warm tail latency and speedup',()=>{
  const base={difficulty:'easy',receiptType:'doc',failed:false,fieldAccuracy:1,criticalAccuracy:1,totalCorrect:true,dateCorrect:true,fallbackUsed:false,recognitions:1};
  const rows=[
    {...base,caseId:'c1',strategyId:'a',elapsedMs:1000,coldStart:true},
    {...base,caseId:'c2',strategyId:'a',elapsedMs:1200,coldStart:true},
    {...base,caseId:'w1',strategyId:'a',elapsedMs:200,coldStart:false},
    {...base,caseId:'w2',strategyId:'a',elapsedMs:300,coldStart:false},
  ];
  const m=compareOcrStrategies({results:rows},{minimumCases:1}).overallRanking[0].metrics;
  assert.equal(m.coldStartP50LatencyMs,1000);assert.equal(m.coldStartP95LatencyMs,1200);
  assert.equal(m.warmP50LatencyMs,200);assert.equal(m.warmP95LatencyMs,300);
  assert.equal(m.coldWarmDeltaMs,850);assert.equal(m.warmSpeedupRatio,4.4);
});

test('benchmark stage diagnostics include sample count max and p95 share',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'stage-meta'}]);
  let n=0;
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,stageTimings:{decode:++n*10,recognition:n*100}})}});
  const m=report.aggregate.a;
  assert.equal(m.stageTimings.recognition.samples,2);
  assert.equal(m.stageTimings.recognition.maxMs,200);
  assert.equal(typeof m.latencyHeadP95Share,'number');
});

test('benchmark reports failure codes and timeout rate without hiding failed latency',()=>{
  const base={difficulty:'easy',receiptType:'doc',fieldAccuracy:0,criticalAccuracy:0,totalCorrect:false,dateCorrect:false,fallbackUsed:false,recognitions:0,coldStart:false};
  const rows=[
    {...base,caseId:'1',strategyId:'a',elapsedMs:100,failed:true,failureCode:'OCR_TIMEOUT'},
    {...base,caseId:'2',strategyId:'a',elapsedMs:200,failed:true,failureCode:'OCR_TIMEOUT'},
    {...base,caseId:'3',strategyId:'a',elapsedMs:50,failed:true,failureCode:'BAD_INPUT'},
    {...base,caseId:'4',strategyId:'a',elapsedMs:20,failed:false,fieldAccuracy:1,criticalAccuracy:1,totalCorrect:true,dateCorrect:true},
  ];
  const m=compareOcrStrategies({results:rows},{minimumCases:1}).overallRanking[0].metrics;
  assert.deepEqual(m.failureCodes,{OCR_TIMEOUT:2,BAD_INPUT:1});
  assert.equal(m.timeoutRate,.5);
  assert.equal(m.p95LatencyMs,200);
});

test('benchmark counts first-useful coverage instead of silently mixing missing samples',async()=>{
  const ds=new OcrBenchmarkDataset([caseA,{...caseA,id:'fu-missing'}]);let n=0;
  const report=await runOcrBenchmark({dataset:ds,strategies:{a:async()=>({receipt:caseA.expected,firstUsefulMs:++n===1?50:null})}});
  assert.equal(report.aggregate.a.firstUsefulSamplesCount,1);
  assert.equal(report.aggregate.a.p50FirstUsefulMs,50);
});

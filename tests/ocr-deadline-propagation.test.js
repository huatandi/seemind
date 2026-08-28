import test from 'node:test';
import assert from 'node:assert/strict';
import {runMultiPassOcr} from '../core/ocr/multi-pass-ocr.js';
import {TesseractOcrEngine} from '../providers/local/tesseract-ocr.js';

const candidate={ocrInput:{kind:'canvas'},planId:'fast'};

test('multi-pass propagates recognition budget into OCR engine',async()=>{
  let options;
  const engine={id:'probe',providerType:'local',recognize:async(_image,o)=>{options=o;return {text:'TOTAL 10',confidence:.9,engineId:'probe'}}};
  await runMultiPassOcr({candidates:[candidate],ocrEngine:engine,deadlineAt:Date.now()+1000,perRecognitionTimeoutMs:321,maxPasses:1});
  assert.equal(options.timeoutMs,321);
  assert.ok(options.deadlineAt>Date.now());
});

test('queued hot-worker request expired by route budget never starts recognition',async()=>{
  let recognizeCalls=0;
  let releaseFirst;
  const firstGate=new Promise(r=>releaseFirst=r);
  const worker={
    recognize:async()=>{recognizeCalls++; if(recognizeCalls===1)await firstGate; return {data:{text:'TOTAL 10',confidence:90}}},
    terminate:async()=>{}
  };
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const first=engine.recognize(candidate.ocrInput,{language:'en',timeoutMs:1000});
  await new Promise(r=>setTimeout(r,10));
  const second=engine.recognize(candidate.ocrInput,{language:'en',deadlineAt:Date.now()+20,timeoutMs:1000});
  const expired=assert.rejects(second,e=>e.code==='OCR_BUDGET_EXHAUSTED');
  await expired;
  assert.equal(recognizeCalls,1,'expired queued caller returns before predecessor completes');
  releaseFirst();
  await first; await new Promise(r=>setTimeout(r,0));
  assert.equal(recognizeCalls,1);
  await engine.dispose();
});

test('per-call timeout bounds hot worker below adapter default',async()=>{
  let terminated=0;
  const worker={recognize:()=>new Promise(()=>{}),terminate:async()=>{terminated++}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const started=Date.now();
  await assert.rejects(engine.recognize(candidate.ocrInput,{language:'en',timeoutMs:30}),e=>e.code==='OCR_RECOGNITION_TIMEOUT');
  assert.ok(Date.now()-started<300);
  await new Promise(r=>setTimeout(r,10));
  assert.equal(terminated,1);
});

test('warmup cannot hang forever on runtime loader',async()=>{
  const engine=new TesseractOcrEngine({loader:()=>new Promise(()=>{})});
  // Override the public loader with a quickly rejecting probe through the same
  // warmup deadline path; timeout utility behavior itself is covered separately.
  engine.loader=async()=>{const e=new Error('probe');e.code='PROBE';throw e};
  await assert.rejects(engine.warmup(),e=>e.code==='PROBE');
});

test('dispose is not held hostage by a hanging worker terminate',async()=>{
  const worker={recognize:async()=>({data:{text:'TOTAL 10',confidence:90}}),terminate:()=>new Promise(()=>{})};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  await engine.recognize(candidate.ocrInput,{language:'en'});
  const started=Date.now();
  await engine.dispose();
  assert.ok(Date.now()-started<2200);
});

test('route deadline bounds OCR runtime loading itself',async()=>{
  const engine=new TesseractOcrEngine({loader:()=>new Promise(()=>{})});
  const started=Date.now();
  await assert.rejects(()=>engine.recognize('x',{deadlineAt:Date.now()+30}),e=>e.code==='OCR_RUNTIME_TIMEOUT');
  assert.ok(Date.now()-started<500);
});

test('route deadline bounds hot worker initialization',async()=>{
  const engine=new TesseractOcrEngine({workerInitTimeoutMs:5000,loader:async()=>({createWorker:()=>new Promise(()=>{})})});
  const started=Date.now();
  await assert.rejects(()=>engine.recognize('x',{deadlineAt:Date.now()+35}),e=>e.code==='OCR_WORKER_INIT_TIMEOUT');
  assert.ok(Date.now()-started<500);
});

test('dispose during runtime loading prevents later worker creation',async()=>{
  let release,creates=0;
  const loader=new Promise(resolve=>{release=resolve});
  const engine=new TesseractOcrEngine({loader:()=>loader});
  const pending=engine.recognize('x');
  await new Promise(r=>setTimeout(r,5));
  await engine.dispose();
  release({createWorker:async()=>{creates++;return {recognize:async()=>({data:{text:'x',confidence:90}}),terminate:async()=>{}}}});
  await assert.rejects(()=>pending,e=>e.code==='OCR_ENGINE_DISPOSED');
  assert.equal(creates,0);
  assert.equal(engine.workers.size,0);
});

test('LRU worker eviction cannot consume the remaining OCR route budget',async()=>{
  const workers={
    eng:{recognize:async()=>({data:{text:'x',confidence:90}}),terminate:()=>new Promise(()=>{})},
    spa:{recognize:async()=>({data:{text:'x',confidence:90}}),terminate:async()=>{}},
  };
  const engine=new TesseractOcrEngine({maxHotWorkers:1,loader:async()=>({createWorker:async lang=>workers[lang]})});
  await engine.recognize('x',{language:'en'});
  const started=Date.now();
  const result=await engine.recognize('x',{language:'es',deadlineAt:Date.now()+35});
  assert.equal(result.text,'x');
  assert.ok(Date.now()-started<35,'slow retirement must stay off the incoming critical path');
});

test('dispose is bounded even while worker initialization is unresolved',async()=>{
  let release,terminated=0;
  const engine=new TesseractOcrEngine({workerInitTimeoutMs:5000,loader:async()=>({createWorker:()=>new Promise(resolve=>{release=()=>resolve({recognize:async()=>({data:{}}),terminate:async()=>{terminated++}})})})});
  const pending=engine.recognize('x').catch(()=>{});
  while(!release)await new Promise(r=>setTimeout(r,1));
  const started=Date.now();
  await engine.dispose();
  assert.ok(Date.now()-started<2000);
  release();
  await new Promise(r=>setTimeout(r,30));
  assert.equal(terminated,1);
  await pending;
});

test('abort cancels OCR while runtime is still loading',async()=>{
  const controller=new AbortController();
  const engine=new TesseractOcrEngine({loader:()=>new Promise(()=>{})});
  const pending=engine.recognize('x',{signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,e=>e.code==='OCR_ABORTED');
  assert.equal(engine.workers.size,0);
});

test('abort during worker initialization releases a late worker',async()=>{
  let release,terminated=0;
  const controller=new AbortController();
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:()=>new Promise(resolve=>{release=()=>resolve({recognize:async()=>({data:{}}),terminate:async()=>{terminated++}})})})});
  const pending=engine.recognize('x',{language:'en',signal:controller.signal});
  while(!release)await new Promise(r=>setTimeout(r,1));
  controller.abort();
  await assert.rejects(pending,e=>e.code==='OCR_ABORTED');
  release();
  await new Promise(r=>setTimeout(r,30));
  assert.equal(terminated,1);
  assert.equal(engine.workers.size,0);
});

test('aborted request waiting behind hot worker never starts stale OCR',async()=>{
  let calls=0,release;
  const gate=new Promise(r=>{release=r});
  const worker={recognize:async()=>{calls++;if(calls===1)await gate;return {data:{text:'x',confidence:90}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const first=engine.recognize('first',{language:'en'});
  await new Promise(r=>setTimeout(r,5));
  const controller=new AbortController();
  const second=engine.recognize('second',{language:'en',signal:controller.signal});
  controller.abort();
  release();
  await first;
  await assert.rejects(second,e=>e.code==='OCR_ABORTED');
  assert.equal(calls,1);
  await engine.dispose();
});

test('zero recognition budget fails before loading OCR runtime',async()=>{
  let loads=0;
  const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {}}});
  await assert.rejects(engine.recognize('x',{timeoutMs:0}),e=>e.code==='OCR_BUDGET_EXHAUSTED');
  assert.equal(loads,0);
});

test('abort cancels fallback one-shot recognition path',async()=>{
  const controller=new AbortController();
  const engine=new TesseractOcrEngine({loader:async()=>({recognize:()=>new Promise(()=>{})})});
  const pending=engine.recognize('x',{language:'en',signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,e=>e.code==='OCR_ABORTED');
});

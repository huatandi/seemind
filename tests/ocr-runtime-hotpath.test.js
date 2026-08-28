import test from 'node:test';
import assert from 'node:assert/strict';
import {TesseractOcrEngine} from '../providers/local/tesseract-ocr.js';

const okWorker=(text='ok')=>({recognize:async()=>({data:{text,confidence:99,blocks:[]}}),terminate:async()=>{}});

test('hot worker second recognition does not invoke runtime loader again',async()=>{
  let loads=0;
  const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>okWorker()}}});
  await engine.recognize({}, {language:'en'}); await engine.recognize({}, {language:'en'});
  assert.equal(loads,1);
});

test('concurrent cold recognitions deduplicate runtime loading',async()=>{
  let loads=0,release; const gate=new Promise(r=>release=r);
  const engine=new TesseractOcrEngine({loader:async()=>{loads++;await gate;return {createWorker:async()=>okWorker()}}});
  const a=engine.recognize({}, {language:'en'}); const b=engine.recognize({}, {language:'es'});
  await new Promise(r=>setTimeout(r,0)); assert.equal(loads,1); release(); await Promise.all([a,b]);
});

test('warmup and recognition share one runtime load',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>okWorker()}}});
  await engine.warmup(); await engine.recognize({}, {language:'en'}); assert.equal(loads,1);
});

test('recognition then warmup reuses cached runtime',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>okWorker()}}});
  await engine.recognize({}, {language:'en'}); await engine.warmup(); assert.equal(loads,1);
});

test('transient runtime loader failure is retryable',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;if(loads===1)throw new Error('network');return {createWorker:async()=>okWorker()}}});
  await assert.rejects(engine.recognize({}, {language:'en'}));
  assert.equal((await engine.recognize({}, {language:'en'})).text,'ok'); assert.equal(loads,2);
});

test('dispose clears cached runtime so replacement lifecycle loads cleanly',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>okWorker()}}});
  await engine.recognize({}, {language:'en'}); await engine.dispose(); await engine.recognize({}, {language:'en'}); assert.equal(loads,2);
});

test('hot worker remains usable even if loader would fail on a later call',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;if(loads>1)throw new Error('offline');return {createWorker:async()=>okWorker('hot')}}});
  await engine.recognize({}, {language:'en'}); const result=await engine.recognize({}, {language:'en'}); assert.equal(result.text,'hot');assert.equal(loads,1);
});

test('hot worker path does not emit runtime-loading again',async()=>{
  const statuses=[]; const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>okWorker()})});
  await engine.recognize({}, {language:'en'}); statuses.length=0;
  await engine.recognize({}, {language:'en',onProgress:m=>statuses.push(m.status)});
  assert.equal(statuses.includes('ocr-runtime-loading'),false);
});

test('logical LRU recency is strictly increasing during same-millisecond bursts',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>okWorker()})});
  await engine.recognize({}, {language:'en'}); const a=engine._workerLastUsed.get('eng');
  await engine.recognize({}, {language:'en'}); const b=engine._workerLastUsed.get('eng'); assert.ok(b>a);
});

test('logical LRU evicts truly older worker without timer sleeps',async()=>{
  const terminated=[]; const engine=new TesseractOcrEngine({maxHotWorkers:2,loader:async()=>({createWorker:async lang=>({recognize:async()=>({data:{text:lang,confidence:99}}),terminate:async()=>terminated.push(lang)})})});
  await engine.recognize({}, {language:'en'}); await engine.recognize({}, {language:'es'}); await engine.recognize({}, {language:'en'}); await engine.recognize({}, {language:'zh-CN'});
  assert.deepEqual(terminated,['spa']);
});

test('cached runtime supports creating a second language without another loader call',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async lang=>okWorker(lang)}}});
  await engine.recognize({}, {language:'en'}); await engine.recognize({}, {language:'es'}); assert.equal(loads,1);
});

test('concurrent same-language cold calls share runtime and worker',async()=>{
  let loads=0,creates=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>{creates++;return okWorker()}}}});
  await Promise.all([engine.recognize({}, {language:'en'}),engine.recognize({}, {language:'en'})]); assert.equal(loads,1);assert.equal(creates,1);
});

test('runtime cache does not change normalized hot-worker diagnostics',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>okWorker()})});
  const a=await engine.recognize({}, {language:'en'}); const b=await engine.recognize({}, {language:'en'});
  assert.equal(a.diagnostics.mode,'tesseract-js-hot-worker');assert.equal(b.diagnostics.mode,'tesseract-js-hot-worker');
});

test('unsupported language still fails without touching cached or uncached loader',async()=>{
  let loads=0; const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>okWorker()}}});
  await assert.rejects(engine.recognize({}, {language:'xx-ZZ'}),e=>e.code==='OCR_LANGUAGE_UNSUPPORTED'); assert.equal(loads,0);
});

test('disposed lifecycle cannot publish a runtime that resolves late',async()=>{
  let release; const gate=new Promise(r=>release=r); const engine=new TesseractOcrEngine({loader:async()=>{await gate;return {createWorker:async()=>okWorker()}}});
  const pending=engine.warmup(); await new Promise(r=>setTimeout(r,0)); await engine.dispose(); release();
  await assert.rejects(pending,e=>e.code==='OCR_ENGINE_DISPOSED'); assert.equal(engine._runtime,null);
});

test('OCR diagnostics expose actionable cold/hot timing without changing normalized text',async()=>{
  const worker={recognize:async()=>({data:{text:'TOTAL 42',confidence:91,blocks:[]}}),terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const cold=await engine.recognize({}, {language:'es-MX'});
  const hot=await engine.recognize({}, {language:'es-MX'});
  assert.equal(cold.text,'TOTAL 42');
  assert.equal(cold.diagnostics.languageHint,'es-mx');
  assert.equal(cold.diagnostics.trainedLanguage,'spa');
  assert.equal(cold.diagnostics.workerCacheHit,false);
  assert.equal(cold.diagnostics.workerCreated,true);
  assert.equal(hot.diagnostics.workerCacheHit,true);
  assert.equal(hot.diagnostics.workerCreated,false);
  for(const result of [cold,hot]){
    for(const key of ['runtimeWaitMs','workerInitWaitMs','queueWaitMs','recognitionMs','totalMs']){
      assert.equal(Number.isFinite(result.diagnostics.timing[key]),true,key);
      assert.equal(result.diagnostics.timing[key]>=0,true,key);
    }
  }
  await engine.dispose();
});

test('queued hot OCR reports queue pressure and explicit recognizing progress',async()=>{
  let release;
  const gate=new Promise(r=>{release=r});
  let calls=0;
  const worker={recognize:async()=>{calls++; if(calls===1)await gate; return {data:{text:'ok',confidence:90,blocks:[]}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const first=engine.recognize({}, {language:'en-US'});
  while(calls===0) await new Promise(r=>setTimeout(r,0));
  const statuses=[];
  const second=engine.recognize({}, {language:'en-US',onProgress:e=>statuses.push(e.status)});
  await new Promise(r=>setTimeout(r,2));
  release();
  await first;
  const result=await second;
  assert.equal(result.diagnostics.queueDepth,1);
  assert.equal(result.diagnostics.timing.queueWaitMs>0,true);
  assert.equal(statuses.includes('ocr-recognizing'),true);
  await engine.dispose();
});

test('LRU retirement does not block incoming language worker creation',async()=>{
  let releaseTerminate; const terminateGate=new Promise(r=>releaseTerminate=r);
  const created=[];
  const engine=new TesseractOcrEngine({maxHotWorkers:1,loader:async()=>({createWorker:async lang=>{created.push(lang);return {recognize:async()=>({data:{text:lang,confidence:99}}),terminate:async()=>{if(lang==='eng')await terminateGate}}}})});
  await engine.recognize({}, {language:'en'});
  const second=engine.recognize({}, {language:'es'});
  await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(created,['eng','spa']);
  releaseTerminate(); await second; await engine.dispose();
});

test('dispose drains workers already retiring in background',async()=>{
  let releaseTerminate,started=false; const gate=new Promise(r=>releaseTerminate=r);
  const engine=new TesseractOcrEngine({maxHotWorkers:1,loader:async()=>({createWorker:async lang=>({recognize:async()=>({data:{text:lang,confidence:99}}),terminate:async()=>{if(lang==='eng'){started=true;await gate}}})})});
  await engine.recognize({}, {language:'en'}); await engine.recognize({}, {language:'es'});
  while(!started)await new Promise(r=>setTimeout(r,0));
  let disposed=false; const pending=engine.dispose().then(()=>disposed=true);
  await new Promise(r=>setTimeout(r,10)); assert.equal(disposed,false);
  releaseTerminate(); await pending; assert.equal(engine._retiringWorkers.size,0);
});

test('queue depth reports more than one waiting recognition',async()=>{
  let release; const gate=new Promise(r=>release=r); let calls=0;
  const worker={recognize:async()=>{calls++;if(calls===1)await gate;return {data:{text:'ok',confidence:99}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const a=engine.recognize({}, {language:'en'}); while(!calls)await new Promise(r=>setTimeout(r,0));
  const b=engine.recognize({}, {language:'en'}); const c=engine.recognize({}, {language:'en'});
  await new Promise(r=>setTimeout(r,2)); release(); await a;
  const [rb,rc]=await Promise.all([b,c]);
  assert.equal(rb.diagnostics.queueDepth,1); assert.equal(rc.diagnostics.queueDepth,2);
  await engine.dispose();
});

test('shared same-language cold initialization is visible in diagnostics',async()=>{
  let release; const gate=new Promise(r=>release=r);
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{await gate;return okWorker()}})});
  const a=engine.recognize({}, {language:'en'}); await new Promise(r=>setTimeout(r,0));
  const b=engine.recognize({}, {language:'en'}); release(); const [,rb]=await Promise.all([a,b]);
  assert.equal(rb.diagnostics.workerCacheHit,true);
  assert.equal(rb.diagnostics.workerInitShared,false); // worker promise existed before runtime branch
  assert.equal(Number.isFinite(rb.diagnostics.timing.totalMs),true);
  await engine.dispose();
});

test('per-language OCR queue is bounded under camera bursts',async()=>{
  let release; const gate=new Promise(r=>release=r); let calls=0;
  const worker={recognize:async()=>{calls++;if(calls===1)await gate;return {data:{text:'ok',confidence:99}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({maxQueueDepth:3,loader:async()=>({createWorker:async()=>worker})});
  const a=engine.recognize({}, {language:'en'}); while(!calls)await new Promise(r=>setTimeout(r,0));
  const b=engine.recognize({}, {language:'en'}); const c=engine.recognize({}, {language:'en'});
  await assert.rejects(engine.recognize({}, {language:'en'}),e=>e.code==='OCR_QUEUE_OVERLOADED');
  release(); await Promise.all([a,b,c]); await engine.dispose();
});

test('queue overload rejection does not corrupt queue accounting',async()=>{
  let release; const gate=new Promise(r=>release=r); let calls=0;
  const worker={recognize:async()=>{calls++;if(calls===1)await gate;return {data:{text:'ok',confidence:99}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({maxQueueDepth:2,loader:async()=>({createWorker:async()=>worker})});
  const a=engine.recognize({}, {language:'en'}); while(!calls)await new Promise(r=>setTimeout(r,0));
  const b=engine.recognize({}, {language:'en'}); await assert.rejects(engine.recognize({}, {language:'en'}),e=>e.code==='OCR_QUEUE_OVERLOADED');
  assert.equal(engine._queueDepths.get('eng'),2); release(); await Promise.all([a,b]); assert.equal(engine._queueDepths.has('eng'),false); await engine.dispose();
});

test('queue capacity is bounded to protect memory even with invalid configuration',()=>{
  assert.equal(new TesseractOcrEngine({maxQueueDepth:999}).maxQueueDepth,8);
  assert.equal(new TesseractOcrEngine({maxQueueDepth:0}).maxQueueDepth,3);
});

test('failed worker initialization does not gain LRU recency',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{throw new Error('init')}})});
  await assert.rejects(engine.recognize({}, {language:'en'})); assert.equal(engine._workerLastUsed.has('eng'),false); await engine.dispose();
});

test('queue overload does not destroy a healthy hot worker',async()=>{
  let release; const gate=new Promise(r=>release=r); let calls=0,terminates=0,creates=0;
  const worker={recognize:async()=>{calls++;if(calls===1)await gate;return {data:{text:'ok',confidence:99}}},terminate:async()=>{terminates++}};
  const engine=new TesseractOcrEngine({maxQueueDepth:1,loader:async()=>({createWorker:async()=>{creates++;return worker}})});
  const a=engine.recognize({}, {language:'en'}); while(!calls)await new Promise(r=>setTimeout(r,0));
  await assert.rejects(engine.recognize({}, {language:'en'}),e=>e.code==='OCR_QUEUE_OVERLOADED');
  assert.equal(engine.workers.has('eng'),true); assert.equal(terminates,0);
  release(); await a; assert.equal((await engine.recognize({}, {language:'en'})).text,'ok'); assert.equal(creates,1); await engine.dispose();
});


test('preloaded global Tesseract createWorker runtime avoids unnecessary dynamic loader',async()=>{
 const previous=globalThis.Tesseract;
 globalThis.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:'global',confidence:99,blocks:[]}}),terminate:async()=>{}})};
 try{
   const engine=new TesseractOcrEngine();
   const result=await engine.recognize({}, {language:'en'});
   assert.equal(result.text,'global');assert.equal(result.diagnostics.workerCreated,true);
   await engine.dispose();
 }finally{globalThis.Tesseract=previous}
});

test('already-aborted OCR request does not start the heavy runtime loader', async()=>{
  let loads=0;
  const engine=new TesseractOcrEngine({loader:async()=>{loads++;return {createWorker:async()=>({recognize:async()=>({data:{text:'late',confidence:90}})})}}});
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(engine.recognize({kind:'cancelled'},{language:'en-US',signal:controller.signal}),e=>e.code==='OCR_ABORTED');
  assert.equal(loads,0);
});

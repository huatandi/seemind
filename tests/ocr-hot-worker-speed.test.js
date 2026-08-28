import test from 'node:test';
import assert from 'node:assert/strict';
import {TesseractOcrEngine,toTesseractLanguage} from '../providers/local/tesseract-ocr.js';

test('regional UI languages map to compact Tesseract traineddata ids',()=>{
  assert.equal(toTesseractLanguage('es-MX'),'spa');
  assert.equal(toTesseractLanguage('en-US'),'eng');
  assert.equal(toTesseractLanguage('zh-CN'),'chi_sim');
  assert.equal(toTesseractLanguage('zh-TW'),'chi_tra');
  assert.equal(toTesseractLanguage('zh-HK'),'chi_tra');
  assert.equal(toTesseractLanguage('zh-Hant'),'chi_tra');
  assert.equal(toTesseractLanguage('zh-Hans'),'chi_sim');
  assert.equal(toTesseractLanguage('zh-TW+en-US'),'chi_tra+eng');
  assert.equal(toTesseractLanguage('auto'),null);
  assert.equal(toTesseractLanguage('ja-JP'),'jpn');
  assert.equal(toTesseractLanguage('ko-KR'),'kor');
  assert.equal(toTesseractLanguage('ar-MX'),'ara');
  assert.equal(toTesseractLanguage('ru-RU'),'rus');
  assert.equal(toTesseractLanguage('hi-IN'),'hin');
  assert.equal(toTesseractLanguage('es-MX+en-US'),'spa+eng');
  assert.equal(toTesseractLanguage('bg-BG'),'bul');
  assert.equal(toTesseractLanguage('sk-SK'),'slk');
  assert.equal(toTesseractLanguage('sl-SI'),'slv');
  assert.equal(toTesseractLanguage('hr-HR'),'hrv');
  assert.equal(toTesseractLanguage('sr-RS'),'srp');
  assert.equal(toTesseractLanguage('fa-IR'),'fas');
  assert.equal(toTesseractLanguage('ur-PK'),'urd');
  assert.equal(toTesseractLanguage('bn-BD'),'ben');
  assert.equal(toTesseractLanguage('ta-IN'),'tam');
  assert.equal(toTesseractLanguage('te-IN'),'tel');
  assert.equal(toTesseractLanguage('mr-IN'),'mar');
  assert.equal(toTesseractLanguage('gu-IN'),'guj');
  assert.equal(toTesseractLanguage('kn-IN'),'kan');
  assert.equal(toTesseractLanguage('ml-IN'),'mal');
  assert.equal(toTesseractLanguage('ne-NP'),'nep');
  assert.equal(toTesseractLanguage('si-LK'),'sin');
  assert.equal(toTesseractLanguage('sw-KE'),'swa');
  assert.equal(toTesseractLanguage('af-ZA'),'afr');
  assert.equal(toTesseractLanguage('et-EE'),'est');
  assert.equal(toTesseractLanguage('lv-LV'),'lav');
  assert.equal(toTesseractLanguage('lt-LT'),'lit');
  assert.equal(toTesseractLanguage('is-IS'),'isl');
  assert.equal(toTesseractLanguage('ga-IE'),'gle');
  assert.equal(toTesseractLanguage('eu-ES'),'eus');
  assert.equal(toTesseractLanguage('gl-ES'),'glg');
});


test('BCP-47 script evidence survives region and extension subtags',()=>{
  const cases=[
    ['zh-Hant-TW','chi_tra'],['zh-Hant-HK','chi_tra'],['zh-Hant-MO','chi_tra'],
    ['zh-Hans-CN','chi_sim'],['zh-Hans-SG','chi_sim'],
    ['zh-Hant-TW-u-nu-hanidec','chi_tra'],['zh-Hans-CN-x-private','chi_sim'],
    ['sr-Latn-RS','srp_latn'],['sr-Latn-BA','srp_latn'],['sr-Cyrl-RS','srp'],
    ['sr-Cyrl-BA','srp'],['sr-Latn-RS-u-ca-gregory','srp_latn'],
    ['az-Latn-AZ','aze'],['az-Cyrl-AZ','aze_cyrl'],['az-Cyrl-AZ-x-test','aze_cyrl'],
    ['uz-Latn-UZ','uzb'],['uz-Cyrl-UZ','uzb_cyrl'],['uz-Cyrl-UZ-u-nu-latn','uzb_cyrl'],
    ['zh_Hant_TW','chi_tra'],['sr_Latn_RS','srp_latn'],['az_Cyrl_AZ','aze_cyrl'],
    ['uz_Cyrl_UZ','uzb_cyrl'],['zh-HK-x-private','chi_tra'],['zh-MO-u-ca-chinese','chi_tra'],
    ['zh-SG-x-private','chi_sim'],
  ];
  assert.equal(cases.length,25);
  for(const [tag,expected] of cases)assert.equal(toTesseractLanguage(tag),expected,tag);
});

test('Tesseract reuses one hot worker for repeated recognition in the same language',async()=>{
  let creates=0,recognitions=0;
  const worker={recognize:async()=>{recognitions++;return {data:{text:'TOTAL 108.00',confidence:95,blocks:[]}}}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return worker}})});
  await engine.recognize(new Blob(['a']),{language:'es-MX'});
  await engine.recognize(new Blob(['b']),{language:'es-MX'});
  assert.equal(creates,1);
  assert.equal(recognitions,2);
});


test('auto OCR uses one hot bootstrap worker and never requests fake auto traineddata',async()=>{
  let creates=0,receivedLanguage=null;
  const worker={recognize:async()=>({data:{text:'TOTAL 60.00',confidence:95,blocks:[]}})};
  const runtime={createWorker:async(language)=>{creates++;receivedLanguage=language;return worker}};
  const engine=new TesseractOcrEngine({loader:async()=>runtime});
  const first=await engine.recognize({kind:'synthetic-a'},{language:'auto'});
  const second=await engine.recognize({kind:'synthetic-b'},{language:'auto'});
  assert.equal(receivedLanguage,'eng');
  assert.equal(creates,1);
  assert.equal(first.text,'TOTAL 60.00');
  assert.equal(second.text,'TOTAL 60.00');
  assert.deepEqual(first.languages,['eng']);
});

test('auto OCR bootstrap language is adapter-configurable without changing global routing',async()=>{
  let receivedLanguage=null;
  const worker={recognize:async()=>({data:{text:'TOTAL 60,00',confidence:95,blocks:[]}})};
  const engine=new TesseractOcrEngine({autoLanguage:'es-MX',loader:async()=>({createWorker:async(language)=>{receivedLanguage=language;return worker}})});
  await engine.recognize({kind:'synthetic'},{language:'auto'});
  assert.equal(receivedLanguage,'spa');
});


test('disposing Tesseract releases every hot language worker and allows a clean restart',async()=>{
  let creates=0,terminations=0;
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{
    creates++;
    return {recognize:async()=>({data:{text:'ok',confidence:90,blocks:[]}}),terminate:async()=>{terminations++}};
  }})});
  await engine.recognize({kind:'es'},{language:'es-MX'});
  await engine.recognize({kind:'zh'},{language:'zh-CN'});
  assert.equal(creates,2);
  await engine.dispose();
  assert.equal(terminations,2);
  assert.equal(engine.workers.size,0);
  await engine.recognize({kind:'es-again'},{language:'es-MX'});
  assert.equal(creates,3);
});

test('disposing during worker initialization still terminates the late worker',async()=>{
  let release,terminations=0;
  const gate=new Promise(resolve=>{release=resolve});
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{
    await gate;
    return {recognize:async()=>({data:{text:'late',confidence:90,blocks:[]}}),terminate:async()=>{terminations++}};
  }})});
  // Seed an initializing worker without awaiting recognition, then dispose while
  // initialization is still pending. Releasing the gate must not leak the worker.
  const recognition=engine.recognize({kind:'late'},{language:'es-MX'}).catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,0));
  const disposal=engine.dispose();
  release();
  await disposal;
  await recognition;
  assert.equal(terminations,1);
  assert.equal(engine.workers.size,0);
});


test('hot worker cache evicts the least-recently-used idle language to bound WASM memory',async()=>{
  const created=[],terminated=[];
  const engine=new TesseractOcrEngine({maxHotWorkers:2,loader:async()=>({createWorker:async(language)=>{
    created.push(language);
    return {recognize:async()=>({data:{text:language,confidence:90,blocks:[]}}),terminate:async()=>{terminated.push(language)}};
  }})});
  await engine.recognize({kind:'en'},{language:'en-US'});
  await new Promise(resolve=>setTimeout(resolve,2));
  await engine.recognize({kind:'es'},{language:'es-MX'});
  await new Promise(resolve=>setTimeout(resolve,2));
  // Touch English so Spanish becomes the least-recently-used idle worker.
  await engine.recognize({kind:'en-2'},{language:'en-US'});
  await engine.recognize({kind:'zh'},{language:'zh-CN'});
  assert.deepEqual(created,['eng','spa','chi_sim']);
  assert.deepEqual(terminated,['spa']);
  assert.equal(engine.workers.size,2);
  assert.equal(engine.workers.has('eng'),true);
  assert.equal(engine.workers.has('chi_sim'),true);
});

test('LRU does not evict a worker that is still initializing', async()=>{
  let resolveFirst;
  const terminated=[];
  const firstWorker={recognize:async()=>({data:{text:'first',confidence:90}}),terminate:async()=>terminated.push('eng')};
  const secondWorker={recognize:async()=>({data:{text:'second',confidence:90}}),terminate:async()=>terminated.push('spa')};
  let creates=0;
  const runtime={createWorker:async lang=>{creates++; if(lang==='eng')return new Promise(r=>{resolveFirst=()=>r(firstWorker)}); return secondWorker}};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxHotWorkers:1,workerInitTimeoutMs:1000});
  const first=engine.recognize({}, {language:'en-US'});
  while(!resolveFirst) await new Promise(r=>setTimeout(r,0));
  const second=engine.recognize({}, {language:'es-MX'});
  await new Promise(r=>setTimeout(r,5));
  assert.deepEqual(terminated,[]);
  resolveFirst();
  const [a,b]=await Promise.all([first,second]);
  assert.equal(a.text,'first'); assert.equal(b.text,'second'); assert.equal(creates,2);
  await engine.dispose();
});

test('dispose invalidates recognition waiting on worker initialization', async()=>{
  let resolveWorker;
  let recognizeCalls=0;
  const worker={recognize:async()=>{recognizeCalls++;return {data:{text:'stale',confidence:90}}},terminate:async()=>{}};
  const runtime={createWorker:()=>new Promise(r=>{resolveWorker=()=>r(worker)})};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,workerInitTimeoutMs:1000});
  const pending=engine.recognize({}, {language:'en-US'});
  while(!resolveWorker) await new Promise(r=>setTimeout(r,0));
  const disposing=engine.dispose();
  resolveWorker();
  await disposing;
  await assert.rejects(pending,e=>e.code==='OCR_ENGINE_DISPOSED');
  assert.equal(recognizeCalls,0);
});

test('unsupported explicit language fails before loading Tesseract runtime', async()=>{
  let loaderCalls=0;
  const engine=new TesseractOcrEngine({loader:async()=>{loaderCalls++;return {}}});
  await assert.rejects(engine.recognize({}, {language:'xx-ZZ'}),e=>e.code==='OCR_LANGUAGE_UNSUPPORTED');
  assert.equal(loaderCalls,0);
});

test('temporary hot-worker overflow converges back to memory cap after busy multilingual burst', async()=>{
  const gates=new Map(),terminated=[];
  const runtime={createWorker:async language=>({
    recognize:async()=>new Promise(resolve=>gates.set(language,()=>resolve({data:{text:language,confidence:90,blocks:[]}}))),
    terminate:async()=>terminated.push(language),
  })};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxHotWorkers:1});
  const en=engine.recognize({kind:'en'},{language:'en-US'});
  while(!gates.has('eng'))await new Promise(r=>setTimeout(r,0));
  const es=engine.recognize({kind:'es'},{language:'es-MX'});
  while(!gates.has('spa'))await new Promise(r=>setTimeout(r,0));
  assert.equal(engine.workers.size,2,'busy workers may temporarily exceed cap');
  gates.get('eng')(); gates.get('spa')();
  await Promise.all([en,es]);
  for(let i=0;i<20&&engine.workers.size>1;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(engine.workers.size,1,'idle overflow must converge back to cap');
  assert.equal(terminated.length,1);
  await engine.dispose();
});

test('post-burst trim never terminates the worker that still owns queued work', async()=>{
  let releaseEn,releaseEs; const terminated=[];
  const runtime={createWorker:async language=>({
    recognize:async()=>new Promise(resolve=>{if(language==='eng')releaseEn=()=>resolve({data:{text:'en',confidence:90}});else releaseEs=()=>resolve({data:{text:'es',confidence:90}})}),
    terminate:async()=>terminated.push(language),
  })};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxHotWorkers:1});
  const en=engine.recognize({}, {language:'en-US'}); while(!releaseEn)await new Promise(r=>setTimeout(r,0));
  const es=engine.recognize({}, {language:'es-MX'}); while(!releaseEs)await new Promise(r=>setTimeout(r,0));
  releaseEn(); await en;
  await new Promise(r=>setTimeout(r,10));
  assert.equal(terminated.includes('spa'),false,'busy Spanish worker must survive trim');
  releaseEs(); await es;
  for(let i=0;i<20&&engine.workers.size>1;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(engine.workers.size,1);
  await engine.dispose();
});

test('deadline-aware queue rejects work that learned warm latency cannot finish', async()=>{
  let releaseFirst;
  const worker={recognize:async image=>{
    if(image.kind==='learn'){await new Promise(r=>setTimeout(r,30));return {data:{text:'learn',confidence:90}}}
    if(image.kind==='hold')return new Promise(r=>{releaseFirst=()=>r({data:{text:'hold',confidence:90}})});
    return {data:{text:'late',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:3});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  const hold=engine.recognize({kind:'hold'},{language:'en-US',deadlineAt:Date.now()+1000});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  await assert.rejects(
    engine.recognize({kind:'late'},{language:'en-US',deadlineAt:Date.now()+5}),
    e=>e.code==='OCR_QUEUE_DEADLINE_IMPOSSIBLE'
  );
  releaseFirst(); await hold; await engine.dispose();
});

test('deadline-aware queue never guesses before real recognition timing exists', async()=>{
  let releaseFirst, calls=0;
  const worker={recognize:async()=>{calls++; if(calls===1)return new Promise(r=>{releaseFirst=()=>r({data:{text:'one',confidence:90}})}); return {data:{text:'two',confidence:90}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:3});
  const first=engine.recognize({}, {language:'en-US',deadlineAt:Date.now()+1000});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  const second=engine.recognize({}, {language:'en-US',deadlineAt:Date.now()+1000});
  releaseFirst(); await Promise.all([first,second]);
  assert.equal(calls,2); await engine.dispose();
});

test('warm recognition estimate is exposed in OCR diagnostics and reset on dispose', async()=>{
  const worker={recognize:async()=>{await new Promise(r=>setTimeout(r,5));return {data:{text:'ok',confidence:90}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const result=await engine.recognize({}, {language:'es-MX'});
  assert.ok(result.diagnostics.estimatedWarmRecognitionMs>0);
  assert.ok(engine._recognitionEwmaMs.has('spa'));
  await engine.dispose();
  assert.equal(engine._recognitionEwmaMs.size,0);
});

test('queue deadline rejection preserves the healthy hot worker', async()=>{
  let releaseFirst; let terminated=0; let calls=0;
  const worker={recognize:async image=>{
    calls++;
    if(image.kind==='learn'){await new Promise(r=>setTimeout(r,25));return {data:{text:'learn',confidence:90}}}
    if(image.kind==='hold')return new Promise(r=>{releaseFirst=()=>r({data:{text:'hold',confidence:90}})});
    return {data:{text:'after',confidence:90}};
  },terminate:async()=>{terminated++}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  const hold=engine.recognize({kind:'hold'},{language:'en-US',deadlineAt:Date.now()+1000});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  await assert.rejects(engine.recognize({kind:'reject'},{language:'en-US',deadlineAt:Date.now()+2}),e=>e.code==='OCR_QUEUE_DEADLINE_IMPOSSIBLE');
  assert.equal(terminated,0,'admission rejection must not kill a healthy worker');
  releaseFirst(); await hold;
  const after=await engine.recognize({kind:'after'},{language:'en-US'});
  assert.equal(after.text,'after');
  assert.equal(after.diagnostics.workerCacheHit,true);
  assert.equal(terminated,0);
  await engine.dispose();
});

test('failed recognition duration never poisons learned warm queue latency', async()=>{
  let mode='learn'; let terminated=0;
  const makeWorker=()=>({recognize:async()=>{
    if(mode==='learn'){await new Promise(r=>setTimeout(r,20));return {data:{text:'ok',confidence:90}}}
    if(mode==='timeout')return new Promise(()=>{});
    return {data:{text:'recovered',confidence:90}};
  },terminate:async()=>{terminated++}});
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>makeWorker()})});
  const learned=await engine.recognize({}, {language:'en-US'});
  const before=learned.diagnostics.estimatedWarmRecognitionMs;
  assert.ok(before>=10);
  mode='timeout';
  await assert.rejects(engine.recognize({}, {language:'en-US',timeoutMs:35}),e=>e.code==='OCR_RECOGNITION_TIMEOUT');
  assert.equal(engine._recognitionEwmaMs.get('eng'),before,'timeout boundary is not a service-time sample');
  mode='recover';
  const recovered=await engine.recognize({}, {language:'en-US'});
  assert.equal(recovered.text,'recovered');
  assert.ok(terminated>=1,'timed-out worker is still retired for safety');
  await engine.dispose();
});


test('one warm timing sample is never enough to reject queued OCR', async()=>{
  let releaseFirst;
  const worker={recognize:async image=>{
    if(image.kind==='learn'){await new Promise(r=>setTimeout(r,20));return {data:{text:'learn',confidence:90}}}
    if(image.kind==='hold')return new Promise(r=>{releaseFirst=()=>r({data:{text:'hold',confidence:90}})});
    return {data:{text:'admitted',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  await engine.recognize({kind:'learn'},{language:'en-US'});
  const hold=engine.recognize({kind:'hold'},{language:'en-US',deadlineAt:Date.now()+1000});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  const queued=engine.recognize({kind:'queued'},{language:'en-US',deadlineAt:Date.now()+500});
  releaseFirst();
  const [,result]=await Promise.all([hold,queued]);
  assert.equal(result.text,'admitted');
  assert.equal(result.diagnostics.recognitionTimingSamples,3);
  await engine.dispose();
});

test('successful timing learns jitter and dispose clears all queue prediction state', async()=>{
  const delays=[5,20,8]; let i=0;
  const worker={recognize:async()=>{await new Promise(r=>setTimeout(r,delays[i++]??5));return {data:{text:'ok',confidence:90}}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  let result;
  for(let n=0;n<3;n++)result=await engine.recognize({}, {language:'es-MX'});
  assert.equal(result.diagnostics.recognitionTimingSamples,3);
  assert.ok(result.diagnostics.recognitionTimingJitterMs>0);
  assert.equal(engine._recognitionSampleCount.get('spa'),3);
  await engine.dispose();
  assert.equal(engine._recognitionSampleCount.size,0);
  assert.equal(engine._recognitionJitterEwmaMs.size,0);
});

test('learned slow device dynamically shrinks burst queue to protect image memory', async()=>{
  let releaseHold;
  const worker={recognize:async image=>{
    if(image.kind==='learn'){await new Promise(r=>setTimeout(r,35));return {data:{text:'learn',confidence:90}}}
    if(image.kind==='hold')return new Promise(r=>{releaseHold=()=>r({data:{text:'hold',confidence:90}})});
    return {data:{text:'extra',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:5,burstRetentionBudgetMs:250});
  for(let i=0;i<3;i++)await engine.recognize({kind:'learn'},{language:'en-US'});
  // Force a clearly slow learned profile without making the test itself wait seconds.
  engine._recognitionEwmaMs.set('eng',180); engine._recognitionJitterEwmaMs.set('eng',80);
  const hold=engine.recognize({kind:'hold'},{language:'en-US'});
  while(!releaseHold)await new Promise(r=>setTimeout(r,0));
  await assert.rejects(engine.recognize({kind:'extra'},{language:'en-US'}),e=>e.code==='OCR_QUEUE_OVERLOADED'&&e.adaptiveQueueDepth===1);
  releaseHold(); await hold; await engine.dispose();
});

test('learned fast device may retain configured burst depth', async()=>{
  let releaseHold;
  const worker={recognize:async image=>{
    if(image.kind==='hold')return new Promise(r=>{releaseHold=()=>r({data:{text:'hold',confidence:90}})});
    return {data:{text:'ok',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:3,burstRetentionBudgetMs:2500});
  engine._recognitionEwmaMs.set('eng',20); engine._recognitionJitterEwmaMs.set('eng',5); engine._recognitionSampleCount.set('eng',3);
  const hold=engine.recognize({kind:'hold'},{language:'en-US'}); while(!releaseHold)await new Promise(r=>setTimeout(r,0));
  const second=engine.recognize({kind:'second'},{language:'en-US'});
  const third=engine.recognize({kind:'third'},{language:'en-US'});
  await new Promise(r=>setTimeout(r,0));
  assert.equal(engine._queueDepths.get('eng'),3);
  releaseHold(); await Promise.all([hold,second,third]); await engine.dispose();
});

test('adaptive burst cap stays disabled before timing evidence floor', async()=>{
  let releaseHold;
  const worker={recognize:async image=>image.kind==='hold'?new Promise(r=>{releaseHold=()=>r({data:{text:'hold',confidence:90}})}):{data:{text:'ok',confidence:90}},terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:2,burstRetentionBudgetMs:250});
  engine._recognitionEwmaMs.set('eng',9999); engine._recognitionSampleCount.set('eng',2);
  const hold=engine.recognize({kind:'hold'},{language:'en-US'}); while(!releaseHold)await new Promise(r=>setTimeout(r,0));
  const queued=engine.recognize({kind:'queued'},{language:'en-US'});
  await new Promise(r=>setTimeout(r,0)); assert.equal(engine._queueDepths.get('eng'),2);
  releaseHold(); await Promise.all([hold,queued]); await engine.dispose();
});

test('adaptive burst depth is observable in successful OCR diagnostics', async()=>{
  const worker={recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:5,burstRetentionBudgetMs:500});
  engine._recognitionEwmaMs.set('eng',200); engine._recognitionJitterEwmaMs.set('eng',50); engine._recognitionSampleCount.set('eng',3);
  const result=await engine.recognize({}, {language:'en-US'});
  assert.equal(result.diagnostics.adaptiveQueueDepth,2);
  assert.equal(result.diagnostics.burstRetentionBudgetMs,500);
  await engine.dispose();
});

test('aborted queued OCR releases its retained image before predecessor settles', async()=>{
  let releaseHold; let queuedRecognitions=0;
  const worker={recognize:async image=>{
    if(image.kind==='hold')return new Promise(r=>{releaseHold=()=>r({data:{text:'hold',confidence:90}})});
    queuedRecognitions++; return {data:{text:'unexpected',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:3});
  const hold=engine.recognize({kind:'hold'},{language:'en-US'}); while(!releaseHold)await new Promise(r=>setTimeout(r,0));
  const controller=new AbortController();
  const largeImage={kind:'queued',payload:new Uint8Array(1024*1024)};
  const queued=engine.recognize(largeImage,{language:'en-US',signal:controller.signal});
  await new Promise(r=>setTimeout(r,0)); controller.abort();
  releaseHold(); await hold;
  await assert.rejects(queued,e=>e.code==='OCR_ABORTED');
  assert.equal(queuedRecognitions,0,'cancelled queued image must never reach worker.recognize');
  assert.equal(engine._queueDepths.size,0);
  await engine.dispose();
});

test('expired queued OCR never starts after predecessor settles', async()=>{
  let releaseHold; let queuedRecognitions=0;
  const worker={recognize:async image=>{
    if(image.kind==='hold')return new Promise(r=>{releaseHold=()=>r({data:{text:'hold',confidence:90}})});
    queuedRecognitions++; return {data:{text:'unexpected',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:3});
  const hold=engine.recognize({kind:'hold'},{language:'en-US'}); while(!releaseHold)await new Promise(r=>setTimeout(r,0));
  const queued=engine.recognize({kind:'queued'},{language:'en-US',deadlineAt:Date.now()+30});
  const expired=assert.rejects(queued,e=>e.code==='OCR_BUDGET_EXHAUSTED');
  await expired;
  assert.equal(queuedRecognitions,0,'expired caller settles before predecessor releases');
  releaseHold(); await hold; await new Promise(r=>setTimeout(r,0));
  assert.equal(queuedRecognitions,0);
  assert.equal(engine._queueDepths.size,0);
  await engine.dispose();
});

test('queued abort settles caller immediately without breaking same-worker serialization tail', async()=>{
  let releaseFirst; const starts=[];
  const runtime={createWorker:async()=>({
    recognize:async image=>{
      starts.push(image.kind);
      if(image.kind==='first')return new Promise(resolve=>{releaseFirst=()=>resolve({data:{text:'first',confidence:90}})});
      return {data:{text:image.kind,confidence:90}};
    },
    terminate:async()=>{},
  })};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxQueueDepth:4});
  const first=engine.recognize({kind:'first'},{language:'en-US'});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  const controller=new AbortController();
  const second=engine.recognize({kind:'cancelled'},{language:'en-US',signal:controller.signal});
  // Allow the second request to join the queue, then cancel while predecessor runs.
  await new Promise(r=>setTimeout(r,5));
  const cancelledAt=Date.now(); controller.abort();
  await assert.rejects(second,e=>e.code==='OCR_ABORTED');
  assert.ok(Date.now()-cancelledAt<100,'queued caller should settle promptly on abort');
  const third=engine.recognize({kind:'third'},{language:'en-US'});
  await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(starts,['first'],'later request must remain behind the real queue tail');
  releaseFirst();
  const [a,c]=await Promise.all([first,third]);
  assert.equal(a.text,'first'); assert.equal(c.text,'third');
  assert.deepEqual(starts,['first','third'],'cancelled queued image must never reach worker');
  await engine.dispose();
});

test('queued deadline settles caller before predecessor completes and preserves queue order', async()=>{
  let releaseFirst; const starts=[];
  const runtime={createWorker:async()=>({
    recognize:async image=>{
      starts.push(image.kind);
      if(image.kind==='first')return new Promise(resolve=>{releaseFirst=()=>resolve({data:{text:'first',confidence:90}})});
      return {data:{text:image.kind,confidence:90}};
    },terminate:async()=>{},
  })};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxQueueDepth:4});
  const first=engine.recognize({kind:'first'},{language:'en-US'});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  const deadlineAt=Date.now()+35;
  const expired=engine.recognize({kind:'expired'},{language:'en-US',deadlineAt});
  const started=Date.now();
  await assert.rejects(expired,e=>e.code==='OCR_BUDGET_EXHAUSTED');
  assert.ok(Date.now()-started<150,'deadline must not wait for predecessor recognition');
  assert.deepEqual(starts,['first']);
  releaseFirst(); await first;
  // Let the internal expired queue node drain and prove it never invokes OCR.
  await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(starts,['first']);
  await engine.dispose();
});

test('multilingual cold starts respect global worker initialization concurrency cap', async()=>{
  let active=0,maxActive=0;
  const runtime={createWorker:async()=>{
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(r=>setTimeout(r,25));
    active--;
    return {recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}};
  }};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxHotWorkers:4,maxConcurrentWorkerInits:2,workerInitTimeoutMs:1000});
  await Promise.all(['en','es','fr','de'].map(language=>engine.recognize({}, {language,timeoutMs:500,deadlineAt:Date.now()+1500})));
  assert.equal(maxActive,2);
  await engine.dispose();
});

test('worker initialization throttle wait is visible in OCR diagnostics', async()=>{
  let releaseFirst;
  const gate=new Promise(r=>{releaseFirst=r});
  let calls=0;
  const runtime={createWorker:async()=>{
    calls++;
    if(calls===1)await gate;
    return {recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}};
  }};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxHotWorkers:2,maxConcurrentWorkerInits:1,workerInitTimeoutMs:1000});
  const first=engine.recognize({}, {language:'en',timeoutMs:500,deadlineAt:Date.now()+1500});
  await new Promise(r=>setTimeout(r,10));
  const second=engine.recognize({}, {language:'es',timeoutMs:500,deadlineAt:Date.now()+1500});
  await new Promise(r=>setTimeout(r,15));releaseFirst();
  const [,result]=await Promise.all([first,second]);
  assert.ok(result.diagnostics.timing.workerInitThrottleWaitMs>=10);
  assert.equal(result.diagnostics.maxConcurrentWorkerInits,1);
  await engine.dispose();
});

test('aborted cold start leaves initialization slot available for next language', async()=>{
  let calls=0;
  const runtime={createWorker:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return {recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}}}};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxConcurrentWorkerInits:1,workerInitTimeoutMs:1000});
  const controller=new AbortController();controller.abort();
  await assert.rejects(engine.recognize({}, {language:'en',signal:controller.signal}),e=>e.code==='OCR_ABORTED');
  const result=await engine.recognize({}, {language:'es',timeoutMs:500,deadlineAt:Date.now()+1000});
  assert.equal(result.text,'ok');
  assert.equal(engine._activeWorkerInits,0);
  await engine.dispose();
});

test('dispose rejects worker-init throttle waiters without leaking slots', async()=>{
  let release;
  const gate=new Promise(r=>{release=r});
  let calls=0;
  const runtime={createWorker:async()=>{calls++;if(calls===1)await gate;return {recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}}}};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxHotWorkers:2,maxConcurrentWorkerInits:1,workerInitTimeoutMs:1000});
  const first=engine.recognize({}, {language:'en',deadlineAt:Date.now()+1500}).catch(e=>e);
  await new Promise(r=>setTimeout(r,10));
  const second=engine.recognize({}, {language:'es',deadlineAt:Date.now()+1500}).catch(e=>e);
  await new Promise(r=>setTimeout(r,10));
  const disposing=engine.dispose();release();
  const secondError=await second;
  assert.equal(secondError.code,'OCR_ENGINE_DISPOSED');
  await first;await disposing;
  assert.equal(engine._workerInitWaiters.length,0);
  assert.equal(engine._activeWorkerInits,0);
});

test('worker init timeout is a total cold-start budget including semaphore wait', async()=>{
  const runtime={createWorker:async()=>({recognize:async()=>({data:{text:'es',confidence:90}}),terminate:async()=>{}})};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxConcurrentWorkerInits:1,workerInitTimeoutMs:250});
  // Occupy the global init semaphore independently so the request's entire cold
  // budget is consumed waiting, rather than racing another request's own timeout.
  await engine._acquireWorkerInitSlot();
  const started=performance.now();
  await assert.rejects(engine.recognize({}, {language:'es-MX'}),e=>e.code==='OCR_WORKER_INIT_TIMEOUT');
  const elapsed=performance.now()-started;
  assert.ok(elapsed<400,`semaphore wait must not receive a second full init budget: ${elapsed}ms`);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('cross-language cold-start backlog is bounded before it can retain unlimited images', async()=>{
  let releaseFirst;
  const runtime={createWorker:async language=>{
    if(language==='eng')return new Promise(resolve=>{releaseFirst=()=>resolve({recognize:async()=>({data:{text:'en',confidence:90}}),terminate:async()=>{}})});
    return {recognize:async()=>({data:{text:language,confidence:90}}),terminate:async()=>{}};
  }};
  const engine=new TesseractOcrEngine({loader:async()=>runtime,maxConcurrentWorkerInits:1,maxWorkerInitWaiters:1,workerInitTimeoutMs:1000});
  const first=engine.recognize({large:'first'}, {language:'en-US'});
  while(!releaseFirst)await new Promise(r=>setTimeout(r,0));
  const waiting=engine.recognize({large:'second'}, {language:'es-MX'});
  while(engine._workerInitWaiters.length<1)await new Promise(r=>setTimeout(r,0));
  await assert.rejects(engine.recognize({large:'third'}, {language:'fr-FR'}),e=>e.code==='OCR_WORKER_INIT_QUEUE_OVERLOADED');
  releaseFirst(); await first; await waiting; await engine.dispose();
});

test('worker-init backlog limits are observable in successful diagnostics', async()=>{
  const engine=new TesseractOcrEngine({maxWorkerInitWaiters:2,loader:async()=>({createWorker:async()=>({recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}})})});
  const result=await engine.recognize({}, {language:'en-US'});
  assert.equal(result.diagnostics.maxWorkerInitWaiters,2);
  assert.equal(result.diagnostics.workerInitWaiterCount,0);
  await engine.dispose();
});

test('slow repeated worker init evidence adaptively serializes future cold starts',()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:3,loader:async()=>({})});
  engine._recordWorkerInitTiming(3000);
  engine._recordWorkerInitTiming(3200);
  assert.equal(engine._effectiveWorkerInitConcurrency(),3,'needs evidence floor before adapting');
  engine._recordWorkerInitTiming(3100);
  assert.equal(engine._effectiveWorkerInitConcurrency(),1);
});

test('fast worker init evidence preserves configured cold-start concurrency',()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:3,loader:async()=>({})});
  for(const ms of [400,500,450,550])engine._recordWorkerInitTiming(ms);
  assert.equal(engine._effectiveWorkerInitConcurrency(),3);
});

test('dispose clears learned worker init scheduling evidence',async()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:3,loader:async()=>({})});
  for(const ms of [3000,3100,3200])engine._recordWorkerInitTiming(ms);
  assert.equal(engine._effectiveWorkerInitConcurrency(),1);
  await engine.dispose();
  assert.equal(engine._effectiveWorkerInitConcurrency(),3);
  assert.equal(engine._workerInitSampleCount,0);
});

test('worker-init scheduler learns jitter and becomes conservative on slow cold starts',()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:3,workerInitTimeoutMs:18000});
  engine._recordWorkerInitTiming(2800);
  engine._recordWorkerInitTiming(3200);
  engine._recordWorkerInitTiming(3000);
  assert.equal(engine._workerInitSampleCount,3);
  assert.ok(engine._workerInitJitterEwmaMs>0);
  assert.ok(engine._estimatedWorkerInitMs()>engine._workerInitEwmaMs);
  assert.equal(engine._effectiveWorkerInitConcurrency(),1);
});

test('worker-init scheduler keeps configured concurrency on consistently fast devices',()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:3,workerInitTimeoutMs:18000});
  engine._recordWorkerInitTiming(300);
  engine._recordWorkerInitTiming(350);
  engine._recordWorkerInitTiming(320);
  assert.equal(engine._effectiveWorkerInitConcurrency(),3);
});

test('cold-start queue rejects a learned impossible deadline before adding a waiter',async()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:1,workerInitTimeoutMs:18000});
  engine._recordWorkerInitTiming(1000);
  engine._recordWorkerInitTiming(1100);
  engine._recordWorkerInitTiming(1050);
  engine._activeWorkerInits=1;
  const before=engine._workerInitWaiters.length;
  await assert.rejects(
    engine._acquireWorkerInitSlot({deadlineAt:Date.now()+100}),
    e=>e.code==='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE'
  );
  assert.equal(engine._workerInitWaiters.length,before);
});

test('dispose clears learned worker-init jitter state',async()=>{
  const engine=new TesseractOcrEngine();
  engine._recordWorkerInitTiming(1000);engine._recordWorkerInitTiming(1600);engine._recordWorkerInitTiming(1200);
  assert.ok(engine._workerInitJitterEwmaMs>0);
  await engine.dispose();
  assert.equal(engine._workerInitEwmaMs,null);
  assert.equal(engine._workerInitJitterEwmaMs,0);
  assert.equal(engine._workerInitSampleCount,0);
});

test('learned cold-start deadline includes wait wave plus callers own init wave',async()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:1,workerInitTimeoutMs:18000});
  for(const ms of [1000,1000,1000])engine._recordWorkerInitTiming(ms);
  engine._activeWorkerInits=1;
  await assert.rejects(
    engine._acquireWorkerInitSlot({deadlineAt:Date.now()+1500}),
    e=>e.code==='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE'
  );
  assert.equal(engine._workerInitWaiters.length,0);
});

test('adaptive init concurrency shrink is honored when an active slot releases',async()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:2,workerInitTimeoutMs:18000});
  engine._activeWorkerInits=2;
  let released=false;
  const waiter={signal:null,reject:()=>{},resolve:()=>{released=true}};
  engine._workerInitWaiters.push(waiter);
  for(const ms of [3000,3200,3100])engine._recordWorkerInitTiming(ms);
  assert.equal(engine._effectiveWorkerInitConcurrency(),1);
  engine._releaseWorkerInitSlot();
  assert.equal(engine._activeWorkerInits,1);
  assert.equal(released,false,'must not refill above newly learned concurrency limit');
  engine._releaseWorkerInitSlot();
  assert.equal(released,true);
  assert.equal(engine._activeWorkerInits,1);
});

test('free init slot still rejects learned impossible cold-start deadline',async()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:2});
  for(const ms of [1000,1000,1000])engine._recordWorkerInitTiming(ms);
  await assert.rejects(engine._acquireWorkerInitSlot({deadlineAt:Date.now()+200}),e=>e.code==='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE');
  assert.equal(engine._activeWorkerInits,0);
});

test('zero worker-init wait budget cannot consume a free semaphore slot',async()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:2});
  await assert.rejects(engine._acquireWorkerInitSlot({maxWaitMs:0}),e=>e.code==='OCR_BUDGET_EXHAUSTED');
  assert.equal(engine._activeWorkerInits,0);
});

test('cold-start deadline prediction learns per-language init cost instead of borrowing a faster language', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),workerInitTimeoutMs:2000});
  // Global history is fast because Latin workers initialized cheaply.
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(40,'eng');
  // CJK history is materially slower on this device.
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(240,'chi_sim');
  assert.ok(engine._estimatedWorkerInitMs('eng')<100);
  assert.ok(engine._estimatedWorkerInitMs('chi_sim')>200);
  await assert.rejects(
    engine._acquireWorkerInitSlot({deadlineAt:Date.now()+120,language:'chi_sim'}),
    e=>e.code==='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE'
  );
  assert.equal(engine._activeWorkerInits,0);
  await engine.dispose();
});

test('cold-start prediction falls back to global evidence until a language has enough samples', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(100,'eng');
  engine._recordWorkerInitTiming(900,'jpn');
  assert.equal(engine._workerInitLanguageSampleCount.get('jpn'),1);
  assert.equal(engine._estimatedWorkerInitMs('jpn'),engine._estimatedWorkerInitMs(),'under-sampled language must use shared device evidence');
  await engine.dispose();
});

test('dispose clears per-language cold-start learning state', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(80,'spa');
  assert.equal(engine._workerInitLanguageSampleCount.get('spa'),3);
  await engine.dispose();
  assert.equal(engine._workerInitLanguageEwmaMs.size,0);
  assert.equal(engine._workerInitLanguageJitterEwmaMs.size,0);
  assert.equal(engine._workerInitLanguageSampleCount.size,0);
});

test('adaptive cold-start concurrency can be conservative for heavy language without penalizing proven fast language', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:2,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(100,'eng');
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(1800,'chi_sim');
  assert.equal(engine._effectiveWorkerInitConcurrency('eng'),2);
  assert.equal(engine._effectiveWorkerInitConcurrency('chi_sim'),1);
  await engine.dispose();
});

test('per-language worker-init learning survives OCR result normalization for field diagnostics', async()=>{
  const worker={recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(120,'eng');
  const result=await engine.recognize({}, {language:'en-US'});
  assert.equal(result.diagnostics.languageWorkerInitTimingSamples,4);
  assert.ok(result.diagnostics.languageWorkerInitTimingMs>0);
  assert.ok(result.diagnostics.estimatedWorkerInitMs>0);
  assert.equal(result.diagnostics.effectiveWorkerInitConcurrency,engine._effectiveWorkerInitConcurrency('eng'));
  await engine.dispose();
});

test('fast-language cold start is not head-of-line blocked behind conservative heavy-language waiter', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:2,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(100,'eng');
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(1800,'chi_sim');
  engine._activeWorkerInits=2;
  let cjkReleased=false,engReleased=false;
  const cjk=engine._acquireWorkerInitSlot({maxWaitMs:1000,language:'chi_sim'}).then(()=>{cjkReleased=true});
  const eng=engine._acquireWorkerInitSlot({maxWaitMs:1000,language:'eng'}).then(()=>{engReleased=true});
  await new Promise(r=>setTimeout(r,0));
  engine._releaseWorkerInitSlot(); // active 2 -> 1: English can use slot 2, CJK cannot.
  await new Promise(r=>setTimeout(r,0));
  assert.equal(engReleased,true);
  assert.equal(cjkReleased,false);
  engine._releaseWorkerInitSlot(); // English finishes; still one active init means CJK remains serialized.
  engine._releaseWorkerInitSlot(); // Last active init finishes; CJK can start.
  await Promise.all([cjk,eng]);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('per-language cold-start jitter is included in deadline estimate', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  engine._recordWorkerInitTiming(100,'jpn');engine._recordWorkerInitTiming(300,'jpn');engine._recordWorkerInitTiming(100,'jpn');
  assert.ok(engine._workerInitLanguageJitterEwmaMs.get('jpn')>0);
  assert.ok(engine._estimatedWorkerInitMs('jpn')>engine._workerInitLanguageEwmaMs.get('jpn'));
  await engine.dispose();
});

test('unknown language cold-start estimate remains device-global', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(140,'spa');
  assert.equal(engine._estimatedWorkerInitMs('fra'),engine._estimatedWorkerInitMs());
  await engine.dispose();
});

test('language-local init evidence does not change configured concurrency before evidence floor', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:3,workerInitTimeoutMs:4000});
  engine._recordWorkerInitTiming(2500,'chi_sim');engine._recordWorkerInitTiming(2500,'chi_sim');
  assert.equal(engine._effectiveWorkerInitConcurrency('chi_sim'),3);
  await engine.dispose();
});

test('language-local init deadline estimate admits a proven fast model despite slower global history', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:2,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(1500,'chi_sim');
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(60,'eng');
  const wait=await engine._acquireWorkerInitSlot({deadlineAt:Date.now()+300,language:'eng'});
  assert.ok(wait>=0);engine._releaseWorkerInitSlot();await engine.dispose();
});

test('language-local init deadline estimate rejects a proven heavy model despite faster recent global samples', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(1600,'chi_sim');
  for(let i=0;i<6;i++)engine._recordWorkerInitTiming(50,'eng');
  await assert.rejects(engine._acquireWorkerInitSlot({deadlineAt:Date.now()+300,language:'chi_sim'}),e=>e.code==='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE');
  await engine.dispose();
});

test('worker-init waiter records language for adaptive refill decisions', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1});
  engine._activeWorkerInits=1;
  const pending=engine._acquireWorkerInitSlot({maxWaitMs:500,language:'spa'});
  await new Promise(r=>setTimeout(r,0));
  assert.equal(engine._workerInitWaiters[0].language,'spa');
  engine._releaseWorkerInitSlot();await pending;engine._releaseWorkerInitSlot();await engine.dispose();
});

test('aborted language-aware init waiter is removed before adaptive refill', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1});
  engine._activeWorkerInits=1;const controller=new AbortController();
  const pending=engine._acquireWorkerInitSlot({maxWaitMs:500,language:'jpn',signal:controller.signal});
  await new Promise(r=>setTimeout(r,0));controller.abort();
  await assert.rejects(pending,e=>e.code==='OCR_ABORTED');
  assert.equal(engine._workerInitWaiters.length,0);engine._releaseWorkerInitSlot();await engine.dispose();
});

test('combined traineddata key can learn its own cold-start cost', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(320,'eng+spa');
  assert.equal(engine._workerInitLanguageSampleCount.get('eng+spa'),3);
  assert.ok(engine._estimatedWorkerInitMs('eng+spa')>=300);
  await engine.dispose();
});

test('invalid cold-start timing samples never poison global or language-local learning', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  for(const value of [0,-1,NaN,Infinity])engine._recordWorkerInitTiming(value,'eng');
  assert.equal(engine._workerInitSampleCount,0);assert.equal(engine._workerInitLanguageSampleCount.size,0);
  await engine.dispose();
});

test('normalized diagnostics expose language init jitter and sample count as finite values', async()=>{
  const worker={recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  engine._recordWorkerInitTiming(80,'spa');engine._recordWorkerInitTiming(140,'spa');engine._recordWorkerInitTiming(100,'spa');
  const result=await engine.recognize({}, {language:'es-MX'});
  assert.ok(Number.isFinite(result.diagnostics.languageWorkerInitTimingJitterMs));
  assert.ok(result.diagnostics.languageWorkerInitTimingSamples>=4);
  await engine.dispose();
});

test('worker init scheduler gives the next slot to the earliest viable deadline',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  engine._activeWorkerInits=1;
  const order=[];
  const far=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+3000,language:'eng'}).then(()=>order.push('far'));
  const near=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+1500,language:'spa'}).then(()=>order.push('near'));
  await new Promise(r=>setTimeout(r,0));
  engine._releaseWorkerInitSlot();
  await near;
  assert.deepEqual(order,['near']);
  engine._releaseWorkerInitSlot();
  await far;
  assert.deepEqual(order,['near','far']);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('worker init scheduler rejects an expired waiter instead of wasting a released slot',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  engine._activeWorkerInits=1;
  const expired=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+20,language:'eng'}).then(()=>null,error=>error);
  const viable=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+2000,language:'spa'});
  await new Promise(r=>setTimeout(r,30));
  engine._releaseWorkerInitSlot();
  assert.equal((await expired)?.code,'OCR_WORKER_INIT_TIMEOUT');
  await viable;
  assert.equal(engine._activeWorkerInits,1);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});


test('worker init scheduler aging prevents sustained EDF starvation',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000,maxWorkerInitStarvationMs:100});
  engine._activeWorkerInits=1;
  const order=[];
  const old=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+3000,language:'eng'}).then(()=>order.push('old'));
  await new Promise(r=>setTimeout(r,120));
  const urgent=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+1000,language:'spa'}).then(()=>order.push('urgent'));
  await new Promise(r=>setTimeout(r,0));
  engine._releaseWorkerInitSlot();
  await old;
  assert.deepEqual(order,['old']);
  engine._releaseWorkerInitSlot();
  await urgent;
  assert.deepEqual(order,['old','urgent']);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('worker init scheduler keeps EDF before starvation threshold',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000,maxWorkerInitStarvationMs:1000});
  engine._activeWorkerInits=1;
  const order=[];
  const far=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+3000,language:'eng'}).then(()=>order.push('far'));
  const near=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+1000,language:'spa'}).then(()=>order.push('near'));
  await new Promise(r=>setTimeout(r,0));
  engine._releaseWorkerInitSlot();
  await near;
  assert.deepEqual(order,['near']);
  engine._releaseWorkerInitSlot();
  await far;
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('worker init scheduler rechecks learned viability when a queued waiter finally reaches dispatch',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(120,'eng');
  engine._activeWorkerInits=1;
  const hopeless=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+220,language:'eng'}).then(()=>null,error=>error);
  const viable=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+1500,language:'spa'});
  await new Promise(r=>setTimeout(r,130));
  engine._releaseWorkerInitSlot();
  assert.equal((await hopeless)?.code,'OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE');
  await viable;
  assert.equal(engine._activeWorkerInits,1);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('dispatch viability recheck never rejects a waiter without enough timing evidence',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  engine._recordWorkerInitTiming(120,'eng');
  engine._activeWorkerInits=1;
  const pending=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+500,language:'eng'});
  await new Promise(r=>setTimeout(r,130));
  engine._releaseWorkerInitSlot();
  await pending;
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});


test('global worker-init timing never rejects an unseen language deadline',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(900,'eng');
  // Global evidence says cold init is ~900ms, but there is no evidence for Japanese.
  // Correctness wins: do not declare the unseen language mathematically impossible.
  const waited=await engine._acquireWorkerInitSlot({deadlineAt:Date.now()+250,language:'jpn'});
  assert.equal(waited,0);
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('language-local worker-init timing can still reject a proven hopeless deadline',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(900,'jpn');
  await assert.rejects(
    engine._acquireWorkerInitSlot({deadlineAt:Date.now()+250,language:'jpn'}),
    error=>error?.code==='OCR_WORKER_INIT_DEADLINE_IMPOSSIBLE'
  );
  assert.equal(engine._activeWorkerInits,0);
  await engine.dispose();
});

test('cold-start admission does not treat lower-priority queued waiters as guaranteed FIFO waves',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000,maxWorkerInitWaiters:8});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(100,'eng');
  engine._activeWorkerInits=1;
  const slowDeadline=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+2000,language:'spa'});
  // English has enough time for the unavoidable active wave + its own init (~200ms),
  // but not enough for a fictitious FIFO wave representing the Spanish waiter.
  const urgent=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+260,language:'eng'});
  engine._releaseWorkerInitSlot();
  await urgent;
  assert.equal(engine._activeWorkerInits,1);
  engine._releaseWorkerInitSlot();
  await slowDeadline;
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('worker init scheduler rejects state-only aborted waiter instead of stranding its promise',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  engine._activeWorkerInits=1;
  // Native wrappers can expose AbortSignal-like state without EventTarget methods.
  const signal={aborted:false};
  const pending=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+2000,language:'eng',signal}).then(()=>null,error=>error);
  await new Promise(r=>setTimeout(r,0));
  signal.aborted=true;
  engine._releaseWorkerInitSlot();
  assert.equal((await pending)?.code,'OCR_ABORTED');
  assert.equal(engine._workerInitWaiters.length,0);
  assert.equal(engine._activeWorkerInits,0);
  await engine.dispose();
});

test('worker init scheduler samples monotonic time once per dispatch ordering epoch',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000,maxWorkerInitStarvationMs:1000});
  engine._activeWorkerInits=1;
  const order=[];
  const far=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+3000,language:'eng'}).then(()=>order.push('far'));
  const near=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+1000,language:'spa'}).then(()=>order.push('near'));
  await new Promise(r=>setTimeout(r,0));
  engine._releaseWorkerInitSlot();
  await near;
  assert.deepEqual(order,['near']);
  engine._releaseWorkerInitSlot();
  await far;
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('aging never preempts a language-local critical cold-start deadline',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000,maxWorkerInitStarvationMs:200});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(120,'eng');
  engine._activeWorkerInits=1;
  const order=[];
  const old=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+3000,language:'spa'}).then(()=>order.push('old'));
  await new Promise(r=>setTimeout(r,220));
  const urgent=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+300,language:'eng'}).then(()=>order.push('urgent'));
  engine._releaseWorkerInitSlot();
  await urgent;
  assert.deepEqual(order,['urgent']);
  engine._releaseWorkerInitSlot();
  await old;
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('aging still promotes old waiter when no deadline has language-local timing evidence',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000,maxWorkerInitStarvationMs:100});
  engine._activeWorkerInits=1;
  const order=[];
  const old=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+3000,language:'spa'}).then(()=>order.push('old'));
  await new Promise(r=>setTimeout(r,150));
  const near=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+800,language:'eng'}).then(()=>order.push('near'));
  engine._releaseWorkerInitSlot();
  await old;
  assert.deepEqual(order,['old']);
  engine._releaseWorkerInitSlot();
  await near;
  engine._releaseWorkerInitSlot();
  await engine.dispose();
});

test('learned hot recognition rejects impossible deadline before calling worker and preserves it', async()=>{
  let calls=0;
  let terminated=0;
  const worker={recognize:async()=>{calls++;return {data:{text:'late'}}},terminate:async()=>{terminated++}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  engine.workers.set('eng',Promise.resolve(worker));
  engine._recognitionEwmaMs.set('eng',500);
  engine._recognitionJitterEwmaMs.set('eng',50);
  engine._recognitionSampleCount.set('eng',3);
  await assert.rejects(engine.recognize({},{language:'en',deadlineAt:Date.now()+100}),e=>e.code==='OCR_RECOGNITION_DEADLINE_IMPOSSIBLE');
  assert.equal(calls,0);
  assert.equal(terminated,0,'deadline admission rejection must not kill a healthy hot worker');
  assert.equal(engine.workers.get('eng') instanceof Promise,true,'healthy hot worker must remain cached');
  const retry=await engine.recognize({},{language:'en',deadlineAt:Date.now()+2000});
  assert.equal(retry.text,'late');
  assert.equal(calls,1,'next viable request should reuse the existing hot worker');
  await engine.dispose();
  assert.equal(terminated,1,'worker is terminated only by normal disposal');
});

test('cold start deadline accounts for learned init plus recognition cost', async()=>{
  let creates=0;
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return {recognize:async()=>({data:{text:'x'}}),terminate:async()=>{}}}})});
  for(const value of [300,320,310])engine._recordWorkerInitTiming(value,'eng');
  engine._recognitionEwmaMs.set('eng',400);
  engine._recognitionJitterEwmaMs.set('eng',20);
  engine._recognitionSampleCount.set('eng',3);
  await assert.rejects(engine.recognize({},{language:'en',deadlineAt:Date.now()+500}),e=>e.code==='OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE');
  assert.equal(creates,0);
  await engine.dispose();
});

test('cold start never rejects from recognition prediction without enough samples', async()=>{
  let creates=0;
  const worker={recognize:async()=>({data:{text:'ok'}}),terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return worker}})});
  for(const value of [20,20,20])engine._recordWorkerInitTiming(value,'eng');
  engine._recognitionEwmaMs.set('eng',1000);
  engine._recognitionSampleCount.set('eng',2);
  const result=await engine.recognize({},{language:'en',deadlineAt:Date.now()+300});
  assert.equal(result.text,'ok');
  assert.equal(creates,1);
  await engine.dispose();
});

test('queued cold-start admission includes learned recognition cost in first-result deadline',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++){
    engine._recordWorkerInitTiming(100,'eng');
    engine._recognitionEwmaMs.set('eng',180);
    engine._recognitionJitterEwmaMs.set('eng',0);
    engine._recognitionSampleCount.set('eng',3);
  }
  engine._activeWorkerInits=1;
  // Active wave + own init ~=200ms, then recognition ~=180ms. 300ms cannot
  // produce a first result even though worker creation alone would fit.
  await assert.rejects(
    engine._acquireWorkerInitSlot({deadlineAt:Date.now()+300,language:'eng'}),
    error=>error?.code==='OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE'
  );
  engine._activeWorkerInits=0;
  await engine.dispose();
});

test('dispatch recheck includes recognition cost before spending released init slot',async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({}),maxConcurrentWorkerInits:1,workerInitTimeoutMs:4000});
  for(let i=0;i<3;i++)engine._recordWorkerInitTiming(80,'eng');
  engine._recognitionEwmaMs.set('eng',140);
  engine._recognitionJitterEwmaMs.set('eng',0);
  engine._recognitionSampleCount.set('eng',3);
  engine._activeWorkerInits=1;
  const pending=engine._acquireWorkerInitSlot({deadlineAt:Date.now()+310,language:'eng'}).then(()=>null,error=>error);
  await new Promise(r=>setTimeout(r,110));
  engine._releaseWorkerInitSlot();
  assert.equal((await pending)?.code,'OCR_FIRST_RESULT_DEADLINE_IMPOSSIBLE');
  assert.equal(engine._activeWorkerInits,0);
  await engine.dispose();
});

test('queue deadline credits elapsed service of an active recognition', async()=>{
  let releaseHold; let lateCalls=0;
  const worker={recognize:async image=>{
    if(image.kind==='hold')return new Promise(resolve=>{releaseHold=()=>resolve({data:{text:'hold',confidence:90}})});
    lateCalls++; return {data:{text:'late',confidence:90}};
  },terminate:async()=>{}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker}),maxQueueDepth:3});
  engine.workers.set('eng',Promise.resolve(worker));
  engine._recognitionEwmaMs.set('eng',100);
  engine._recognitionJitterEwmaMs.set('eng',0);
  engine._recognitionSampleCount.set('eng',3);
  const hold=engine.recognize({kind:'hold'},{language:'en',deadlineAt:Date.now()+1000});
  while(!releaseHold)await new Promise(r=>setTimeout(r,0));
  // Simulate that most of the learned 100ms service has already elapsed. A full
  // predecessor charge would reject a 150ms budget (~230ms with margin), while
  // remaining-service accounting admits it (~126ms with margin).
  engine._activeRecognitionStartedAt.set('eng',performance.now()-90);
  const late=engine.recognize({kind:'late'},{language:'en',deadlineAt:Date.now()+150});
  releaseHold();
  const [,result]=await Promise.all([hold,late]);
  assert.equal(result.text,'late');
  assert.equal(lateCalls,1);
  await engine.dispose();
});

test('active recognition timing state is cleared on dispose', async()=>{
  const engine=new TesseractOcrEngine({loader:async()=>({})});
  engine._activeRecognitionStartedAt.set('eng',performance.now());
  await engine.dispose();
  assert.equal(engine._activeRecognitionStartedAt.size,0);
});


test('cold-created healthy worker survives request-local deadline rejection before recognition', async()=>{
  let creates=0;
  let calls=0;
  let terminated=0;
  const worker={
    recognize:async()=>{calls++;return {data:{text:'reused'}}},
    terminate:async()=>{terminated++},
  };
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return worker}})});
  // Recognition history can exist while language-local init history is unavailable
  // (for example after lifecycle/cache churn). That means the cold worker may be
  // created successfully before the route can prove recognition itself is too late.
  engine._recognitionEwmaMs.set('eng',500);
  engine._recognitionJitterEwmaMs.set('eng',50);
  engine._recognitionSampleCount.set('eng',3);
  await assert.rejects(
    engine.recognize({},{language:'en',deadlineAt:Date.now()+200}),
    error=>error.code==='OCR_RECOGNITION_DEADLINE_IMPOSSIBLE',
  );
  assert.equal(creates,1);
  assert.equal(calls,0,'impossible request must not enter recognize');
  assert.equal(terminated,0,'healthy cold-created worker must not be killed by request-local rejection');
  assert.equal(engine.workers.get('eng') instanceof Promise,true);
  const retry=await engine.recognize({},{language:'en',deadlineAt:Date.now()+2000});
  assert.equal(retry.text,'reused');
  assert.equal(creates,1,'next viable request must reuse the worker created by the rejected request');
  assert.equal(calls,1);
  await engine.dispose();
  assert.equal(terminated,1);
});

test('shared cold-init waiter aborts immediately without killing another callers worker', async()=>{
  let releaseInit; let terminated=0; let creates=0;
  const worker={recognize:async()=>({data:{text:'ok',confidence:90}}),terminate:async()=>{terminated++}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return new Promise(resolve=>{releaseInit=()=>resolve(worker)})}})});
  const owner=engine.recognize({kind:'owner'},{language:'en',deadlineAt:Date.now()+2000});
  while(!releaseInit)await new Promise(r=>setTimeout(r,0));
  const controller=new AbortController();
  const shared=engine.recognize({kind:'stale'},{language:'en',deadlineAt:Date.now()+2000,signal:controller.signal});
  controller.abort();
  await assert.rejects(shared,error=>error.code==='OCR_ABORTED');
  assert.equal(terminated,0,'shared waiter abort must not retire the owners in-flight worker');
  releaseInit();
  assert.equal((await owner).text,'ok');
  assert.equal(creates,1,'same-language cold start must remain single-flight');
  assert.equal(terminated,0);
  await engine.dispose();
  assert.equal(terminated,1);
});

test('shared cold-init waiter respects its own route deadline and leaves shared worker reusable', async()=>{
  let releaseInit; let terminated=0; let creates=0;
  const worker={recognize:async image=>({data:{text:image.kind,confidence:90}}),terminate:async()=>{terminated++}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return new Promise(resolve=>{releaseInit=()=>resolve(worker)})}})});
  const owner=engine.recognize({kind:'owner'},{language:'en',deadlineAt:Date.now()+2000});
  while(!releaseInit)await new Promise(r=>setTimeout(r,0));
  const started=performance.now();
  await assert.rejects(
    engine.recognize({kind:'expired'},{language:'en',deadlineAt:Date.now()+35}),
    error=>error.code==='OCR_BUDGET_EXHAUSTED',
  );
  assert.ok(performance.now()-started<250,'shared waiter should not wait for the owners slow initialization');
  assert.equal(terminated,0);
  releaseInit();
  assert.equal((await owner).text,'owner');
  const retry=await engine.recognize({kind:'retry'},{language:'en',deadlineAt:Date.now()+1000});
  assert.equal(retry.text,'retry');
  assert.equal(creates,1,'expired shared waiter must not force a new cold worker');
  await engine.dispose();
  assert.equal(terminated,1);
});


test('cold-init owner abort does not kill shared initialization needed by a live waiter', async()=>{
  let releaseInit; let terminated=0; let creates=0;
  const worker={recognize:async image=>({data:{text:image.kind,confidence:90}}),terminate:async()=>{terminated++}};
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{creates++;return new Promise(resolve=>{releaseInit=()=>resolve(worker)})}})});
  const controller=new AbortController();
  const owner=engine.recognize({kind:'owner'},{language:'en',deadlineAt:Date.now()+2000,signal:controller.signal});
  while(!releaseInit)await new Promise(r=>setTimeout(r,0));
  const live=engine.recognize({kind:'live'},{language:'en',deadlineAt:Date.now()+2000});
  controller.abort();
  await assert.rejects(owner,error=>error.code==='OCR_ABORTED');
  assert.equal(terminated,0,'aborting the first request must not retire a shared in-flight initialization');
  releaseInit();
  assert.equal((await live).text,'live');
  assert.equal(creates,1,'live waiter must inherit the original single-flight worker');
  assert.equal(terminated,0);
  await engine.dispose();
  assert.equal(terminated,1);
});


test('cold-init owner abort while waiting for global slot does not poison live same-language waiter', async()=>{
  let releaseFrench; let creates=0;
  const workers=[];
  const engine=new TesseractOcrEngine({
    maxConcurrentWorkerInits:1,
    loader:async()=>({createWorker:async language=>{
      creates++;
      if(language==='fra')await new Promise(resolve=>{releaseFrench=resolve});
      const worker={recognize:async image=>({data:{text:image.kind,confidence:90}}),terminate:async()=>{}};
      workers.push(worker);
      return worker;
    }})
  });

  // Occupy the only global cold-start slot with another language.
  const blocker=engine.recognize({kind:'blocker'},{language:'fr',deadlineAt:Date.now()+2000});
  while(!releaseFrench)await new Promise(r=>setTimeout(r,0));

  const controller=new AbortController();
  const owner=engine.recognize({kind:'owner'},{language:'en',deadlineAt:Date.now()+2000,signal:controller.signal});
  // Let English publish its shared init promise and queue for the occupied slot.
  await new Promise(r=>setTimeout(r,5));
  const live=engine.recognize({kind:'live'},{language:'en',deadlineAt:Date.now()+2000});
  controller.abort();
  await assert.rejects(owner,error=>error.code==='OCR_ABORTED');

  releaseFrench();
  await blocker;
  assert.equal((await live).text,'live','live follower must survive the first callers abort while init is queued');
  assert.equal(creates,2,'English cold start must remain a single shared initialization');
  await engine.dispose();
});


test('stale init-slot release cannot decrement a newer lifecycle semaphore', ()=>{
  const engine=new TesseractOcrEngine({maxConcurrentWorkerInits:1});
  const staleGeneration=engine._lifecycleGeneration;
  engine._lifecycleGeneration++;
  engine._activeWorkerInits=1;
  engine._releaseWorkerInitSlot(staleGeneration);
  assert.equal(engine._activeWorkerInits,1);
  engine._releaseWorkerInitSlot(engine._lifecycleGeneration);
  assert.equal(engine._activeWorkerInits,0);
});


test('stale runtime rejection after dispose cannot clear a newer lifecycle runtime promise',async()=>{
  let calls=0,releaseOld;
  const oldGate=new Promise(resolve=>{releaseOld=resolve});
  const runtimeNew={createWorker:async()=>({recognize:async()=>({data:{text:'new',confidence:90}}),terminate:async()=>{}})};
  const engine=new TesseractOcrEngine({loader:async()=>{
    calls++;
    if(calls===1){await oldGate;return {createWorker:async()=>({recognize:async()=>({data:{text:'old',confidence:90}})})}};
    return runtimeNew;
  }});
  const stale=engine._loadRuntime({timeoutMs:1000}).catch(error=>error);
  await new Promise(resolve=>setTimeout(resolve,0));
  await engine.dispose();
  const fresh=engine._loadRuntime({timeoutMs:1000});
  const freshRuntime=await fresh;
  assert.equal(freshRuntime,runtimeNew);
  const freshPromise=engine._runtimePromise;
  releaseOld();
  const staleError=await stale;
  assert.equal(staleError.code,'OCR_ENGINE_DISPOSED');
  assert.equal(engine._runtimePromise,freshPromise);
  assert.equal(await engine._loadRuntime({timeoutMs:1000}),runtimeNew);
  assert.equal(calls,2);
  await engine.dispose();
});


test('recognition cannot start a new WASM lifecycle while dispose is still draining the old worker',async()=>{
  let terminateStarted=false,releaseTerminate;
  const terminateGate=new Promise(resolve=>{releaseTerminate=resolve});
  let creates=0;
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>{
    creates++;
    return {
      recognize:async()=>({data:{text:'ok',confidence:99}}),
      terminate:async()=>{terminateStarted=true;await terminateGate}
    };
  }})});
  assert.equal((await engine.recognize({}, {language:'en'})).text,'ok');
  const disposing=engine.dispose();
  while(!terminateStarted)await new Promise(resolve=>setTimeout(resolve,0));
  await assert.rejects(engine.recognize({}, {language:'es'}),error=>error.code==='OCR_ENGINE_DISPOSING');
  assert.equal(creates,1,'teardown window must not overlap a fresh WASM worker lifecycle');
  releaseTerminate();
  await disposing;
  assert.equal((await engine.recognize({}, {language:'es'})).text,'ok','engine remains reusable after teardown completes');
  assert.equal(creates,2);
  releaseTerminate();
  await engine.dispose();
});

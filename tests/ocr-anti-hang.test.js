import test from 'node:test';import assert from 'node:assert/strict';
import {withDeadline} from '../core/performance/timeout.js';
import {TesseractOcrEngine} from '../providers/local/tesseract-ocr.js';

test('deadline rejects a hung operation with a stable code',async()=>{
 await assert.rejects(()=>withDeadline(new Promise(()=>{}),10,'OCR_TEST_TIMEOUT'),e=>e.code==='OCR_TEST_TIMEOUT');
});

test('hot tesseract worker serializes concurrent recognitions',async()=>{
 let active=0,maxActive=0,calls=0;
 const worker={recognize:async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,8));active--;calls++;return {data:{text:'ok',confidence:90}}}};
 const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
 await Promise.all([engine.recognize(new Blob(['a']),{language:'es'}),engine.recognize(new Blob(['b']),{language:'es'})]);
 assert.equal(calls,2);assert.equal(maxActive,1);
});


test('late tesseract worker is terminated after init timeout instead of leaking',async()=>{
 let terminated=0;
 const lateWorker={terminate:async()=>{terminated++}};
 const engine=new TesseractOcrEngine({
   workerInitTimeoutMs:250,
   loader:async()=>({createWorker:()=>new Promise(resolve=>setTimeout(()=>resolve(lateWorker),280))}),
 });
 await assert.rejects(()=>engine.recognize(new Blob(['a']),{language:'es'}),e=>e.code==='OCR_WORKER_INIT_TIMEOUT');
 await new Promise(resolve=>setTimeout(resolve,60));
 assert.equal(terminated,1);
 assert.equal(engine.workers.size,0);
});

test('deadline helper can be cancelled without waiting for timeout',async()=>{
 const {withDeadline}=await import('../core/performance/timeout.js');
 const controller=new AbortController();
 const pending=withDeadline(new Promise(()=>{}),5000,'TOO_SLOW',{signal:controller.signal,abortCode:'OCR_ABORTED'});
 controller.abort();
 await assert.rejects(pending,e=>e.code==='OCR_ABORTED');
});

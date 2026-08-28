import test from 'node:test';
import assert from 'node:assert/strict';
import {TesseractOcrEngine} from '../providers/local/tesseract-ocr.js';

test('failed hot worker is evicted and terminated before next recognition', async()=>{
  let creates=0, terminates=0;
  const workers=[];
  const runtime={
    recognize:async()=>({data:{text:'',confidence:0}}),
    createWorker:async()=>{
      creates++;
      const worker={
        recognize:async()=>{ throw Object.assign(new Error('OCR_RECOGNITION_TIMEOUT'),{code:'OCR_RECOGNITION_TIMEOUT'}); },
        terminate:async()=>{terminates++;},
      };
      workers.push(worker);
      return worker;
    }
  };
  const engine=new TesseractOcrEngine({loader:async()=>runtime});
  await assert.rejects(()=>engine.recognize({}, {language:'en'}),e=>e.code==='OCR_RECOGNITION_TIMEOUT');
  await new Promise(r=>setTimeout(r,0));
  assert.equal(terminates,1);
  assert.equal(engine.workers.has('eng'),false);
  await assert.rejects(()=>engine.recognize({}, {language:'en'}));
  assert.equal(creates,2,'next request must create a fresh worker instead of reusing poisoned state');
});

test('dispose prevents an already queued OCR task from starting later', async()=>{
  let recognizeCalls=0;
  let releaseFirst;
  const firstGate=new Promise(resolve=>{releaseFirst=resolve});
  const worker={
    async recognize(){
      recognizeCalls++;
      if(recognizeCalls===1) await firstGate;
      return {data:{text:'ok',confidence:90,words:[]}};
    },
    async terminate(){}
  };
  const engine=new TesseractOcrEngine({loader:async()=>({createWorker:async()=>worker})});
  const first=engine.recognize({id:1},{language:'en'});
  await new Promise(resolve=>setTimeout(resolve,10));
  const second=engine.recognize({id:2},{language:'en'});
  await new Promise(resolve=>setTimeout(resolve,10));
  const disposing=engine.dispose();
  releaseFirst();
  await first.catch(()=>{});
  await assert.rejects(second,error=>error?.code==='OCR_ENGINE_DISPOSED');
  await disposing;
  assert.equal(recognizeCalls,1);
});

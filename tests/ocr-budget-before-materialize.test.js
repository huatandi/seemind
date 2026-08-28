import test from 'node:test';
import assert from 'node:assert/strict';
import {runMultiPassOcr} from '../core/ocr/multi-pass-ocr.js';

test('expired OCR budget does not materialize a candidate image', async()=>{
  let materialized=0;
  const candidate={getBlob:async()=>{materialized++;return new Blob(['x'])}};
  const engine={providerType:'remote',recognize:async()=>({text:'',confidence:0})};
  await assert.rejects(runMultiPassOcr({candidates:[candidate],ocrEngine:engine,deadlineAt:Date.now()-1}),e=>e.code==='OCR_BUDGET_EXHAUSTED');
  assert.equal(materialized,0);
});

test('candidate materialization cannot outlive OCR route budget', async()=>{
  const candidate={getBlob:()=>new Promise(resolve=>setTimeout(()=>resolve(new Blob(['x'])),80))};
  const engine={providerType:'remote',recognize:async()=>({text:'',confidence:0})};
  const started=Date.now();
  await assert.rejects(runMultiPassOcr({candidates:[candidate],ocrEngine:engine,deadlineAt:Date.now()+20}),e=>e.code==='OCR_IMAGE_PREPARATION_BUDGET_TIMEOUT');
  assert.ok(Date.now()-started<70);
});

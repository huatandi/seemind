import test from 'node:test';
import assert from 'node:assert/strict';
import {runMultiPassOcr} from '../core/ocr/multi-pass-ocr.js';

test('local OCR consumes prepared drawable without forcing blob encoding',async()=>{
  let blobCalls=0;
  const drawable={kind:'prepared-canvas'};
  const candidate={planId:'fast',ocrInput:drawable,getBlob:async()=>{blobCalls++;return new Blob(['x'])}};
  let received=null;
  const engine={id:'local',providerType:'local',recognize:async image=>{received=image;return {engineId:'local',text:'TOTAL 108.00',confidence:.9,blocks:[]}}};
  await runMultiPassOcr({candidates:[candidate],ocrEngine:engine,maxPasses:1});
  assert.equal(received,drawable);
  assert.equal(blobCalls,0);
});

test('gateway OCR lazily materializes blob only when provider requires it',async()=>{
  let blobCalls=0;
  const payload=new Blob(['x']);
  const candidate={planId:'remote',ocrInput:{kind:'prepared-canvas'},getBlob:async()=>{blobCalls++;return payload}};
  let received=null;
  const engine={id:'gateway',providerType:'gateway',recognize:async image=>{received=image;return {engineId:'gateway',text:'TOTAL 108.00',confidence:.9,blocks:[]}}};
  await runMultiPassOcr({candidates:[candidate],ocrEngine:engine,maxPasses:1});
  assert.equal(received,payload);
  assert.equal(blobCalls,1);
});

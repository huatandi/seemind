import test from 'node:test';
import assert from 'node:assert/strict';
import {PaddleGatewayOcrService} from '../gateway/core/paddle-ocr-service.js';
import {HttpPaddleOcrEngine} from '../providers/gateway/http-paddle-ocr.js';
import {OcrEngine} from '../core/ocr/ocr-engine.js';
import {runOcrEnsemble} from '../core/ocr/ocr-ensemble.js';

function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body}}
const C=id=>({blob:new Blob(['x'],{type:'image/png'}),planId:id,selectedPlan:{id}});

test('gateway paddle OCR stays explicitly disabled by default',async()=>{
  const svc=new PaddleGatewayOcrService({config:{enabled:false}});
  const h=await svc.health();
  assert.equal(h.status,'disabled');
  await assert.rejects(()=>svc.recognize({imageBase64:'eA=='}),e=>e.code==='PADDLE_OCR_DISABLED');
});

test('gateway paddle service converts real upstream response into provider-neutral OCR result',async()=>{
  const fetchImpl=async(url,opts)=>{
    assert.match(url,/\/v1\/ocr$/);
    assert.equal(opts.method,'POST');
    return response(200,{text:'TOTAL 100.00',confidence:93,blocks:[{text:'TOTAL 100.00',confidence:.95,bbox:[1,2,3,4]}],engineVersion:'ppocr-x'});
  };
  const svc=new PaddleGatewayOcrService({config:{enabled:true,endpoint:'http://127.0.0.1:8866',timeoutMs:1000},fetchImpl});
  const r=await svc.recognize({imageBase64:'eA==',mimeType:'image/png',language:'spa+eng'});
  assert.equal(r.engineId,'paddle-ocr');
  assert.equal(r.confidence,.93);
  assert.equal(r.blocks[0].text,'TOTAL 100.00');
  assert.equal(svc.publicState().successes,1);
});

test('gateway paddle upstream failure is classified and does not leak arbitrary error',async()=>{
  const fetchImpl=async()=>response(503,{error:'secret internal stack'});
  const svc=new PaddleGatewayOcrService({config:{enabled:true,endpoint:'http://local',timeoutMs:1000},fetchImpl});
  await assert.rejects(()=>svc.recognize({imageBase64:'eA=='}),e=>e.code==='PADDLE_OCR_UPSTREAM_FAILED');
  assert.equal(svc.publicState().failures,1);
  assert.equal(svc.publicState().lastErrorCode,'PADDLE_OCR_UPSTREAM_FAILED');
});

test('HTTP Paddle engine calls gateway endpoint and normalizes response',async()=>{
  const fetchImpl=async(url,opts)=>{
    assert.equal(url,'http://127.0.0.1:8787/v1/ocr/paddle');
    const body=JSON.parse(opts.body);
    assert.ok(body.imageBase64);
    return response(200,{engineId:'paddle-ocr',engineVersion:'x',providerType:'local-service',text:'TOTAL 10.00',confidence:.88,blocks:[]});
  };
  const e=new HttpPaddleOcrEngine({gatewayUrl:'http://127.0.0.1:8787',fetchImpl});
  const r=await e.recognize(new Blob(['abc'],{type:'image/png'}));
  assert.equal(r.engineId,'paddle-ocr');
  assert.equal(r.confidence,.88);
});

class FailEngine extends OcrEngine{
  constructor(){super('paddle-ocr',{priority:90,languages:['spa'],capabilities:{text:true}})}
  async recognize(){const e=new Error('PADDLE_OCR_UNAVAILABLE');e.code='PADDLE_OCR_UNAVAILABLE';throw e}
}
class GoodEngine extends OcrEngine{
  constructor(){super('tesseract-js',{priority:50,languages:['spa'],capabilities:{text:true}})}
  async recognize(){return this.normalize({engineId:this.id,text:'FECHA 20/08/2026\nTOTAL 10.00',confidence:.7})}
}

test('ensemble falls back to Tesseract when Paddle service is unavailable',async()=>{
  const r=await runOcrEnsemble({
    candidates:[C('a')],
    engines:[new FailEngine(),new GoodEngine()],
    maxEngines:2,maxPassesPerEngine:1,maxTotalRecognitions:2,
  });
  assert.equal(r.selectedEngineId,'tesseract-js');
  const failed=r.engines.find(x=>x.engineId==='paddle-ocr');
  assert.equal(failed.status,'failed');
  assert.equal(failed.errorCode,'PADDLE_OCR_UNAVAILABLE');
});

test('ensemble throws only when all OCR engines fail',async()=>{
  await assert.rejects(()=>runOcrEnsemble({
    candidates:[C('a')],
    engines:[new FailEngine()],
    maxEngines:1,maxPassesPerEngine:1,maxTotalRecognitions:1,
  }),e=>e.code==='ALL_OCR_ENGINES_FAILED'&&e.failures[0].engineId==='paddle-ocr');
});

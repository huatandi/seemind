import test from 'node:test';
import assert from 'node:assert/strict';
import {OcrEngine} from '../core/ocr/ocr-engine.js';
import {OcrEngineRegistry} from '../core/ocr/ocr-engine-registry.js';
import {normalizeOcrResult,assertOcrResult} from '../core/ocr/ocr-result.js';
import {PaddleOcrEngine} from '../providers/local/paddle-ocr.js';
import {runOcrEnsemble} from '../core/ocr/ocr-ensemble.js';

class FakeEngine extends OcrEngine{
  constructor(id,outputs,{priority=50,languages=['spa','eng'],capabilities={text:true}}={}){
    super(id,{version:'test-1',languages,capabilities,priority});
    this.outputs=[...outputs];this.calls=0;
  }
  async recognize(){
    const out=this.outputs[Math.min(this.calls,this.outputs.length-1)];
    this.calls++;
    return this.normalize({...out,engineId:this.id,engineVersion:this.version});
  }
}
const C=id=>({blob:{id},planId:id,selectedPlan:{id}});

test('OCR result contract normalizes provider-neutral shape',()=>{
  const r=normalizeOcrResult({engineId:'x',text:'hola',confidence:87,blocks:[{text:'hola',confidence:.8,bbox:[1,2,3,4]}]},{id:'x'});
  assert.equal(r.confidence,1); // contract requires adapter to normalize percentages before boundary
  assert.equal(r.text,'hola');
  assert.equal(r.blocks[0].text,'hola');
  assertOcrResult(r);
});

test('registry rejects duplicates and filters by capability/language',()=>{
  const a=new FakeEngine('a',[{text:'x',confidence:.5}],{capabilities:{text:true,bboxes:false}});
  const b=new FakeEngine('b',[{text:'x',confidence:.5}],{priority:90,capabilities:{text:true,bboxes:true}});
  const r=new OcrEngineRegistry([a,b]);
  assert.equal(r.list()[0].id,'b');
  assert.deepEqual(r.select({language:'spa+eng',requiredCapabilities:['bboxes']}).map(x=>x.id),['b']);
  assert.throws(()=>r.register(b),/DUPLICATE_OCR_ENGINE/);
});

test('Paddle adapter is explicitly unconfigured until a runtime runner is injected',async()=>{
  const p=new PaddleOcrEngine();
  await assert.rejects(()=>p.recognize({}),/PADDLE_OCR_RUNTIME_NOT_CONFIGURED/);
});

test('Paddle adapter converts injected runner output into common OCR contract',async()=>{
  const p=new PaddleOcrEngine({version:'ppocr-test',runner:async()=>({
    text:'TOTAL 100.00',confidence:92,
    lines:[{text:'TOTAL 100.00',confidence:95,box:[1,2,30,10]}],
    orientation:0,
  })});
  const r=await p.recognize({});
  assert.equal(r.engineId,'paddle-ocr');
  assert.equal(r.confidence,.92);
  assert.equal(r.blocks[0].confidence,.95);
  assert.deepEqual(r.blocks[0].bbox,[1,2,30,10]);
  assert.equal(r.diagnostics.orientation,0);
});

test('OCR ensemble can select another engine when its receipt evidence is stronger',async()=>{
  const highConfidenceWeak=new FakeEngine('fast-ocr',[
    {text:'TOTAL 999.99',confidence:.97},
    {text:'TOTAL 999.99',confidence:.97},
  ],{priority:90});
  const evidenceStrong=new FakeEngine('receipt-ocr',[
    {text:'FECHA 20/08/2026\nSUBTOTAL 647.51\nIVA 8.87\nTOTAL 656.38\nEFECTIVO 700.00\nCAMBIO 43.62',confidence:.82},
    {text:'FECHA 20/08/2026\nTOTAL 656.38',confidence:.80},
  ],{priority:60});
  const r=await runOcrEnsemble({
    candidates:[C('a'),C('b')],
    engines:[highConfidenceWeak,evidenceStrong],
    maxEngines:2,maxPassesPerEngine:2,maxTotalRecognitions:4
  });
  assert.equal(r.selectedEngineId,'receipt-ocr');
  assert.equal(r.selected.receipt.total.value,65638);
});

test('OCR ensemble enforces total recognition budget across engines',async()=>{
  const a=new FakeEngine('a',Array.from({length:4},()=>({text:'TOTAL 10.00',confidence:.5})));
  const b=new FakeEngine('b',Array.from({length:4},()=>({text:'TOTAL 10.00',confidence:.6})));
  await runOcrEnsemble({
    candidates:[C('1'),C('2'),C('3')],
    engines:[a,b],
    maxEngines:2,maxPassesPerEngine:3,maxTotalRecognitions:4
  });
  assert.equal(a.calls+b.calls,4);
  assert.equal(a.calls,3);
  assert.equal(b.calls,1);
});

test('registry public profiles contain no runtime runner or implementation functions',()=>{
  const p=new PaddleOcrEngine({runner:async()=>({text:'x',confidence:.5})});
  const [profile]=new OcrEngineRegistry([p]).profiles();
  assert.equal(profile.id,'paddle-ocr');
  assert.equal('runner' in profile,false);
  assert.equal(typeof profile.capabilities,'object');
});

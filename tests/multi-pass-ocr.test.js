import test from 'node:test';
import assert from 'node:assert/strict';
import {runMultiPassOcr,scoreReceiptOcrPass} from '../core/ocr/multi-pass-ocr.js';

function fakeEngine(outputs){
  let i=0;
  return {recognize:async()=>outputs[i++]};
}
const candidate=id=>({blob:{id},planId:id,selectedPlan:{id}});

test('multi-pass selects lower OCR confidence when receipt evidence is materially stronger',async()=>{
  const engine=fakeEngine([
    {engineId:'fake',confidence:.96,text:'T0TAL 999.99'},
    {engineId:'fake',confidence:.86,text:'FECHA 20/08/2026\nSUBTOTAL 647.51\nIVA 8.87\nTOTAL 656.38\nEFECTIVO 700.00\nCAMBIO 43.62'},
  ]);
  const r=await runMultiPassOcr({candidates:[candidate('rawish'),candidate('receipt-good')],ocrEngine:engine,maxPasses:2});
  assert.equal(r.selectedPlanId,'receipt-good');
  assert.equal(r.selected.receipt.total.value,65638);
});

test('arithmetic conflict reduces OCR pass score',()=>{
  const good=scoreReceiptOcrPass({ocr:{confidence:.8},normalization:{confidence:1,transformations:[]},receipt:{total:{value:10800},date:{value:'2026-08-20'},checks:[{status:'supported'}]}});
  const bad=scoreReceiptOcrPass({ocr:{confidence:.8},normalization:{confidence:1,transformations:[]},receipt:{total:{value:12000},date:{value:'2026-08-20'},checks:[{status:'conflicted'}]}});
  assert.ok(good.score>bad.score);
});

test('normalization-heavy candidate pays bounded recovery penalty',()=>{
  const base={ocr:{confidence:.8},receipt:{total:{value:10000},date:{value:'2026-08-20'},checks:[]}};
  const clean=scoreReceiptOcrPass({...base,normalization:{confidence:1,transformations:[]}});
  const noisy=scoreReceiptOcrPass({...base,normalization:{confidence:.93,transformations:Array.from({length:8},()=>({}))}});
  assert.ok(clean.score>noisy.score);
  assert.ok(noisy.score>=0);
});

test('multi-pass is hard bounded and does not OCR every supplied candidate',async()=>{
  let calls=0;
  const engine={recognize:async()=>{calls++;return {engineId:'fake',confidence:.5,text:'TOTAL 10.00'}}};
  await runMultiPassOcr({candidates:[candidate('a'),candidate('b'),candidate('c'),candidate('d')],ocrEngine:engine,maxPasses:2});
  assert.equal(calls,2);
});

test('multi-pass exposes compact per-pass audit metadata but selected keeps full result',async()=>{
  const engine=fakeEngine([
    {engineId:'fake',confidence:.7,text:'TOTAL 10.00'},
    {engineId:'fake',confidence:.8,text:'FECHA 20/08/2026\nTOTAL 10.00'},
  ]);
  const r=await runMultiPassOcr({candidates:[candidate('a'),candidate('b')],ocrEngine:engine});
  assert.equal(r.passes.length,2);
  assert.ok(r.passes.every(x=>x.scoring&&x.receiptSummary));
  assert.equal(r.selected.normalization.rawText.includes('FECHA'),true);
});

test('ties prefer higher OCR confidence then stable original pass order',async()=>{
  const engine=fakeEngine([
    {engineId:'fake',confidence:.7,text:'TOTAL 10.00'},
    {engineId:'fake',confidence:.9,text:'TOTAL 10.00'},
  ]);
  const r=await runMultiPassOcr({candidates:[candidate('a'),candidate('b')],ocrEngine:engine});
  assert.equal(r.selectedPlanId,'b');
});

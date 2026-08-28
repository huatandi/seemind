import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOcrText} from '../core/ocr/ocr-normalizer.js';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';

test('normalizer repairs spaced receipt labels without changing unrelated text',()=>{
  const n=normalizeOcrText('T O T A L 656.38\nPRODUCTO TOTALMENTE NUEVO');
  assert.match(n.normalizedText,/TOTAL 656\.38/);
  assert.match(n.normalizedText,/PRODUCTO TOTALMENTE NUEVO/);
  assert.ok(n.transformations.some(x=>x.rule==='JOIN_TOTAL_LABEL'));
});

test('normalizer repairs common O/0 and I/1 label confusions',()=>{
  const n=normalizeOcrText('T0TAL 656.38\n1VA 8.87\nCAMB10 43.62\nEFECT1V0 700.00');
  assert.match(n.normalizedText,/TOTAL 656\.38/);
  assert.match(n.normalizedText,/IVA 8\.87/);
  assert.match(n.normalizedText,/CAMBIO 43\.62/);
  assert.match(n.normalizedText,/EFECTIVO 700\.00/);
});

test('normalizer repairs OCR glyphs only inside amount-shaped tokens',()=>{
  const n=normalizeOcrText('OXXO\nTOTAL $7O.OO\nFOLIO OIIO');
  assert.match(n.normalizedText,/OXXO/);
  assert.match(n.normalizedText,/TOTAL \$70\.00/);
  assert.match(n.normalizedText,/FOLIO OIIO/);
});

test('normalizer preserves raw text and emits auditable transformation trail',()=>{
  const raw='T0TAL $7O.OO';
  const n=normalizeOcrText(raw);
  assert.equal(n.rawText,raw);
  assert.equal(n.changed,true);
  assert.ok(n.transformations.length>=2);
  assert.ok(n.transformations.every(x=>x.rule&&typeof x.confidence==='number'));
});

test('normalizer can reconnect exact SUBTOTAL line break',()=>{
  const n=normalizeOcrText('SUB\nTOTAL 100.00\nIVA 8.00\nTOTAL 108.00');
  const r=parseReceiptText(n.normalizedText);
  assert.equal(r.subtotal.value,10000);
  assert.equal(r.total.value,10800);
});

test('adjacent duplicate nonfinancial header line is removed but duplicate IVA lines remain',()=>{
  const n=normalizeOcrText('EL FLORIDO\nEL FLORIDO\nIVA 8.00\nIVA 8.00\nTOTAL 16.00');
  assert.equal(n.normalizedText.split('\n').filter(x=>x==='EL FLORIDO').length,1);
  assert.equal(n.normalizedText.split('\n').filter(x=>x==='IVA 8.00').length,2);
  const r=parseReceiptText(n.normalizedText);
  assert.equal(r.tax.value,1600);
});

test('normalization plus parser recovers a noisy Mexican receipt summary',()=>{
  const raw='EL FLORIDO\nSUBT0TAL 647.51\n1VA 8% 8.87\nT0TAL $656.38\nEFECT1V0 7O0.00\nCAMB10 43.62';
  const n=normalizeOcrText(raw);
  const r=parseReceiptText(n.normalizedText);
  assert.equal(r.subtotal.value,64751);
  assert.equal(r.tax.value,887);
  assert.equal(r.total.value,65638);
  assert.equal(r.cash.value,70000);
  assert.equal(r.change.value,4362);
});

test('normalizer does not invent missing TOTAL',()=>{
  const n=normalizeOcrText('EFECT1V0 700.00\nCAMB10 43.62');
  const r=parseReceiptText(n.normalizedText);
  assert.equal(r.total.value,null);
  assert.equal(r.total.status,'unresolved');
});

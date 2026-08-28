import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText,parseLocalizedAmount} from '../features/receipt/receipt-parser.js';

test('distinguishes subtotal IVA total efectivo and cambio',()=>{
  const r=parseReceiptText('SUBTOTAL 647.51\nIVA 8% 8.87\nTOTAL $656.38\nEFECTIVO 700.00\nCAMBIO 43.62');
  assert.equal(r.subtotal.value,64751);assert.equal(r.tax.value,887);assert.equal(r.total.value,65638);assert.equal(r.cash.value,70000);assert.equal(r.change.value,4362);
  assert.equal(r.checks.find(x=>x.id==='cash-change-total').status,'supported');
});

test('never guesses total without TOTAL label even when cash-change can derive it',()=>{
  const r=parseReceiptText('EFECTIVO 700.00\nCAMBIO 43.62');
  assert.equal(r.total.value,null);assert.equal(r.total.status,'unresolved');
});

test('does not confuse total de articulos with total amount',()=>{
  const r=parseReceiptText('TOTAL DE ARTICULOS: 22\nEFECTIVO 700.00');
  assert.equal(r.total.value,null);
});

test('supports common Mexican receipt date variants',()=>{
  assert.equal(parseReceiptText('FECHA 20/08/2026').date.value,'2026-08-20');
  assert.equal(parseReceiptText('FECHA 20-08-2026').date.value,'2026-08-20');
  assert.equal(parseReceiptText('FECHA 20 08 2026').date.value,'2026-08-20');
  assert.equal(parseReceiptText('FECHA 20AGO2026').date.value,'2026-08-20');
  assert.equal(parseReceiptText('FECHA 2026-08-20').date.value,'2026-08-20');
});

test('normalizes dot and comma decimal formats into integer centavos',()=>{
  assert.equal(parseLocalizedAmount('1,234.56'),123456);
  assert.equal(parseLocalizedAmount('1.234,56'),123456);
  assert.equal(parseLocalizedAmount('656,38'),65638);
});

test('detects arithmetic conflict but does not rewrite OCR values',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8.00\nTOTAL 120.00\nEFECTIVO 120.00\nCAMBIO 0.00');
  const c=r.checks.find(x=>x.id==='subtotal-tax-total');
  assert.equal(c.status,'conflicted');
  assert.equal(r.total.value,12000);
});

test('recovers TOTAL currency symbol misread as leading 5 only with independent arithmetic evidence',()=>{
  const r=parseReceiptText('SUBTOTAL 647.51\nIVA 8% 8.87\nTOTAL 5656.38\nEFECTIVO 700.00\nCAMBIO 43.62');
  assert.equal(r.total.value,65638);
  assert.equal(r.total.rule,'SEMANTIC_CURRENCY_5_RECOVERY');
  assert.equal(r.total.rawValue,'5656.38');
});

test('does not strip a legitimate leading 5 amount without supporting evidence',()=>{
  const r=parseReceiptText('TOTAL 5656.38\nEFECTIVO 5700.00\nCAMBIO 43.62');
  assert.equal(r.total.value,565638);
  assert.notEqual(r.total.rule,'SEMANTIC_CURRENCY_5_RECOVERY');
});

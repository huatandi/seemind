import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';

test('intelligence exposes amount candidate pool with labels',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8% 8.00\nTOTAL 108.00');
  assert.ok(r.intelligence.candidatePool.length>=3);
  assert.ok(r.intelligence.candidatePool.some(x=>x.labels.includes('subtotal')&&x.amounts.some(a=>a.minor===10000)));
  assert.ok(r.intelligence.candidatePool.some(x=>x.labels.includes('total')&&x.amounts.some(a=>a.minor===10800)));
});

test('cash minus change can suggest TOTAL candidate but never auto-fill missing TOTAL',()=>{
  const r=parseReceiptText('EFECTIVO 700.00\nCAMBIO 43.62');
  assert.equal(r.total.value,null);
  assert.equal(r.intelligence.totalAssessment.status,'unresolved');
  assert.deepEqual(r.intelligence.totalAssessment.suggestedCandidates,[65638]);
  assert.equal(r.intelligence.totalAssessment.mayAutoFill,false);
});

test('subtotal plus IVA can suggest TOTAL but cannot create it',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8.00');
  assert.equal(r.total.value,null);
  assert.ok(r.intelligence.relations.some(x=>x.id==='subtotal-tax-total-candidate'&&x.expectedMinor===10800));
});

test('IVA percentage relation supports consistent tax',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8% 8.00\nTOTAL 108.00');
  const c=r.checks.find(x=>x.id==='subtotal-iva-rate-tax');
  assert.equal(c.status,'supported');
  assert.equal(c.rate,8);
  assert.equal(c.expectedMinor,800);
});

test('IVA percentage conflict is visible and lowers tax confidence without rewriting tax',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8% 12.00\nTOTAL 112.00');
  const c=r.checks.find(x=>x.id==='subtotal-iva-rate-tax');
  assert.equal(c.status,'conflicted');
  assert.equal(r.tax.value,1200);
  assert.ok(r.tax.confidence<=.9);
  assert.ok(r.tax.evidenceConflictCount>=1);
  assert.ok(r.tax.evidenceSupportCount>=1);
});

test('conflicting arithmetic lowers TOTAL confidence but preserves labeled value',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8.00\nTOTAL 120.00\nEFECTIVO 120.00\nCAMBIO 0.00');
  assert.equal(r.total.value,12000);
  assert.equal(r.checks.find(x=>x.id==='subtotal-tax-total').status,'conflicted');
  assert.ok(r.total.confidence<=.9);
});

test('independent supported relations increase TOTAL confidence',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8% 8.00\nTOTAL 108.00\nEFECTIVO 120.00\nCAMBIO 12.00');
  assert.equal(r.total.value,10800);
  assert.ok(r.total.evidenceSupportCount>=2);
  assert.ok(r.total.confidence>=.97);
  assert.equal(r.intelligence.totalAssessment.status,'supported');
});

test('full Spanish month date is recognized',()=>{
  assert.equal(parseReceiptText('FECHA 20 DE AGOSTO DE 2026').date.value,'2026-08-20');
  assert.equal(parseReceiptText('20 DICIEMBRE 2026').date.value,'2026-12-20');
  assert.equal(parseReceiptText('3 DE ENERO DE 2026').date.value,'2026-01-03');
});

test('invalid full Spanish month date stays unresolved',()=>{
  assert.equal(parseReceiptText('FECHA 31 DE FEBRERO DE 2026').date.value,null);
});

test('quality flags missing date or total for review',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8.00');
  assert.equal(r.intelligence.quality.needsReview,true);
});

test('quality can be strong when core fields and arithmetic agree',()=>{
  const r=parseReceiptText('EL FLORIDO\nFECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8% 8.00\nTOTAL 108.00');
  assert.ok(r.intelligence.quality.score>=.8);
  assert.equal(r.intelligence.quality.conflictedRelations,0);
});

test('currency-symbol 5 recovery remains evidence-gated in v2',()=>{
  const r=parseReceiptText('SUBTOTAL 647.51\nIVA 8.87\nTOTAL 5656.38\nEFECTIVO 700.00\nCAMBIO 43.62');
  assert.equal(r.total.value,65638);
  assert.equal(r.total.rule,'SEMANTIC_CURRENCY_5_RECOVERY');
  assert.ok(r.intelligence.totalAssessment.supportedRelations>=1);
});

test('legitimate leading 5 remains unchanged without supporting evidence',()=>{
  const r=parseReceiptText('TOTAL 5656.38');
  assert.equal(r.total.value,565638);
  assert.notEqual(r.total.rule,'SEMANTIC_CURRENCY_5_RECOVERY');
});

test('TOTAL DE ARTICULOS remains excluded from final total and candidate assessment',()=>{
  const r=parseReceiptText('TOTAL DE ARTICULOS 22\nEFECTIVO 100.00');
  assert.equal(r.total.value,null);
  assert.equal(r.intelligence.totalAssessment.mayAutoFill,false);
});

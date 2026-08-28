import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';
import {buildUniversalStructuredFacts} from '../core/facts/universal-facts.js';

test('retail receipt maps shared fields into universal categories',()=>{
  const r=parseReceiptText('EL FLORIDO\nTOTAL DE ARTICULOS 3\nFECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00');
  assert.equal(r.facts.documentType.value,'retail_receipt');
  assert.equal(r.facts.index['identity.merchant'].value,'EL FLORIDO');
  assert.equal(r.facts.index['time.date'].value,'2026-08-20');
  assert.equal(r.facts.index['money.subtotal'].value,10000);
  assert.equal(r.facts.index['money.tax'].value,800);
  assert.equal(r.facts.index['money.total'].value,10800);
  assert.equal(r.facts.index['money.total'].unit,'XXX-minor');
});

test('bank transfer maps parties banking and transfer amount without inventing receipt total',()=>{
  const r=parseReceiptText('TRANSFERENCIA SPEI\nORDENANTE: JUAN PEREZ\nBENEFICIARIO: COMERCIAL MX\nBANCO EMISOR: BBVA\nBANCO RECEPTOR: BANORTE\nCLAVE DE RASTREO: ABC123\nREFERENCIA: 9988\nIMPORTE: 500.00\nCLABE: 012345678901234567');
  assert.equal(r.facts.documentType.value,'bank_transfer');
  assert.equal(r.facts.index['parties.sender'].value,'JUAN PEREZ');
  assert.equal(r.facts.index['parties.receiver'].value,'COMERCIAL MX');
  assert.equal(r.facts.index['banking.senderBank'].value,'BBVA');
  assert.equal(r.facts.index['banking.receiverBank'].value,'BANORTE');
  assert.equal(r.facts.index['banking.trackingKey'].value,'ABC123');
  assert.equal(r.facts.index['banking.reference'].value,'9988');
  assert.equal(r.facts.index['banking.accountLast4'].value,'4567');
  assert.equal(r.facts.index['money.transferAmount'].value,50000);
  assert.equal(r.facts.index['money.total'].value,null);
});

test('CFDI facts use fiscal namespace',()=>{
  const r=parseReceiptText('COMERCIALIZADORA NORTE SA DE CV\nRFC EMISOR ABC010101AA1\nCFDI 4.0\nFOLIO FISCAL 550E8400-E29B-41D4-A716-446655440000\nREGIMEN FISCAL 601 GENERAL DE LEY PERSONAS MORALES\nUSO CFDI G03 - GASTOS EN GENERAL\nTOTAL 116.00');
  assert.equal(r.facts.index['fiscal.issuerRfc'].value,'ABC010101AA1');
  assert.equal(r.facts.index['fiscal.uuid'].value,'550E8400-E29B-41D4-A716-446655440000');
  assert.match(r.facts.index['fiscal.regime'].value,/601/);
  assert.match(r.facts.index['fiscal.cfdiUse'].value,/G03/);
});

test('gas-station domain facts preserve units',()=>{
  const r=parseReceiptText('ESTACION DEL NORTE\nPERMISO C.R.E. PL-1\nMAGNA\nLITROS 30.5\nPRECIO POR LITRO 19.67\nTOTAL 599.94');
  assert.equal(r.facts.index['domain.crePermit'].value,'PL-1');
  assert.equal(r.facts.index['domain.fuelProduct'].value,'MAGNA');
  assert.equal(r.facts.index['domain.liters'].value,30.5);
  assert.equal(r.facts.index['domain.liters'].unit,'L');
  assert.equal(r.facts.index['domain.pricePerLiter'].value,1967);
  assert.equal(r.facts.index['domain.pricePerLiter'].unit,'XXX-minor');
});

test('restaurant facts remain domain facts rather than accounting fields',()=>{
  const r=parseReceiptText('LA TERRAZA\nMESA 12\nMESERO JUAN\nCOMENSALES 4\nPROPINA 30.00\nTOTAL 330.00');
  assert.equal(r.facts.index['domain.tip'].value,3000);
  assert.equal(r.facts.index['domain.table'].value,'12');
  assert.equal(r.facts.index['domain.server'].value,'JUAN');
  assert.equal(r.facts.index['domain.guests'].value,4);
});

test('brand and legal entity remain separate universal facts',()=>{
  const r=parseReceiptText('OXXO\nCADENA COMERCIAL OXXO SA DE CV\nRFC ABC010101AA1\nTOTAL 100.00');
  assert.equal(r.facts.index['identity.brand'].value,'OXXO');
  assert.match(r.facts.index['identity.legalEntity'].value,/CADENA COMERCIAL OXXO/i);
});

test('field evidence is preserved in universal fact',()=>{
  const r=parseReceiptText('TOTAL $656.38');
  const fact=r.facts.index['money.total'];
  assert.equal(fact.value,65638);
  assert.equal(fact.evidence[0].rule,'LABEL_AMOUNT_MATCH');
  assert.match(fact.evidence[0].sourceText,/TOTAL/);
  assert.equal(fact.provenance.source,'local');
});

test('arithmetic conflict is attached to affected facts without rewriting values',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8.00\nTOTAL 120.00');
  assert.equal(r.facts.index['money.total'].value,12000);
  assert.ok(r.facts.index['money.total'].conflicts.some(x=>x.id==='subtotal-tax-total'));
  assert.ok(r.facts.index['money.tax'].conflicts.some(x=>x.id==='subtotal-tax-total'));
});

test('unresolved fields remain explicit facts instead of disappearing',()=>{
  const r=parseReceiptText('EL FLORIDO');
  assert.ok('money.total' in r.facts.index);
  assert.equal(r.facts.index['money.total'].status,'unresolved');
  assert.equal(r.facts.index['money.total'].value,null);
});

test('universal fact policy explicitly forbids accounting inference',()=>{
  const r=parseReceiptText('TOTAL 100.00');
  assert.equal(r.facts.policy.factsOnly,true);
  assert.equal(r.facts.policy.noAccountingClassification,true);
  assert.equal(r.facts.policy.noIncomeExpenseInference,true);
  assert.equal(r.facts.policy.noAutoPosting,true);
});

test('universal facts contain no accounting classification keys',()=>{
  const r=parseReceiptText('TRANSFERENCIA SPEI\nIMPORTE 500.00\nBANCO RECEPTOR BBVA');
  const serialized=JSON.stringify(r.facts);
  for(const forbidden of ['expenseCategory','incomeCategory','accountingCategory','journalEntry','debitAccount','creditAccount','autoPost']){
    assert.equal(serialized.includes(forbidden),false);
  }
});

test('fact summary counts resolved unresolved and conflicted facts',()=>{
  const r=parseReceiptText('SUBTOTAL 100.00\nIVA 8.00\nTOTAL 120.00');
  assert.ok(r.facts.summary.totalFacts>=8);
  assert.ok(r.facts.summary.resolvedFacts>=3);
  assert.ok(r.facts.summary.unresolvedFacts>=1);
  assert.ok(r.facts.summary.conflictedFacts>=2);
});

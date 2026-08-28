import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';
import {classifyReceiptType,receiptTypeFieldPolicy} from '../features/receipt/receipt-type-intelligence.js';

test('OXXO is classified as convenience store with known brand merchant',()=>{
  const r=parseReceiptText('OXXO\nRFC ABC010101AA1\nTOTAL 100.00\nEFECTIVO 120.00\nCAMBIO 20.00');
  assert.equal(r.receiptType.type,'convenience_store');
  assert.ok(r.receiptType.confidence>=.8);
  assert.equal(r.merchant.value,'OXXO');
  assert.equal(r.merchant.rule,'KNOWN_BRAND_MATCH');
});

test('gas station evidence outranks generic retail summary words',()=>{
  const r=parseReceiptText('ESTACION DEL NORTE\nPERMISO C.R.E. PL-123\nMAGNA\nLITROS 30.00\nIVA 40.00\nTOTAL 600.00');
  assert.equal(r.receiptType.type,'gas_station');
  assert.ok(r.receiptType.evidence.some(x=>x.reason==='fuel'));
});

test('CFDI invoice is classified separately from ordinary retail receipt',()=>{
  const r=parseReceiptText('COMERCIALIZADORA DEL NORTE SA DE CV\nRFC ABC010101AA1\nCFDI 4.0\nFOLIO FISCAL 123\nIVA 16.00\nTOTAL 116.00');
  assert.equal(r.receiptType.type,'cfdi_invoice');
  assert.equal(r.intelligence.receiptType.fieldPolicy.change,'not_expected');
});

test('bank transfer evidence is not forced into receipt assumptions',()=>{
  const r=parseReceiptText('TRANSFERENCIA SPEI\nCLAVE DE RASTREO ABC123\nBANCO RECEPTOR BBVA\nREFERENCIA 9988');
  assert.equal(r.receiptType.type,'bank_transfer');
  assert.equal(r.intelligence.receiptType.fieldPolicy.tax,'not_expected');
  assert.equal(r.total.value,null);
});

test('restaurant clues classify restaurant without requiring a known brand',()=>{
  const r=parseReceiptText('LA TERRAZA\nMESA 12\nMESERO JUAN\nSUBTOTAL 300.00\nIVA 48.00\nPROPINA 30.00\nTOTAL 378.00');
  assert.equal(r.receiptType.type,'restaurant');
  assert.equal(r.merchant.value,'LA TERRAZA');
});

test('ordinary item-count receipt is retail receipt',()=>{
  const r=parseReceiptText('MI TIENDA\nTICKET 100\nTOTAL DE ARTICULOS 4\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00');
  assert.equal(r.receiptType.type,'retail_receipt');
});

test('weak ambiguous text remains unknown instead of guessed',()=>{
  const x=classifyReceiptType('GRACIAS POR SU COMPRA\nFOLIO 123');
  assert.equal(x.type,'unknown');
  assert.equal(x.confidence,0);
});

test('merchant slogan is not treated as merchant',()=>{
  const r=parseReceiptText('GRACIAS POR SU COMPRA\nTOTAL 100.00');
  assert.equal(r.merchant.value,null);
});

test('known brand can coexist with different legal entity',()=>{
  const r=parseReceiptText('OXXO\nCADENA COMERCIAL OXXO SA DE CV\nRFC ABC010101AA1\nTOTAL 100.00');
  assert.equal(r.merchant.value,'OXXO');
  assert.equal(r.intelligence.merchantIdentity.brand.value,'OXXO');
  assert.match(r.intelligence.merchantIdentity.legalEntity.value,/CADENA COMERCIAL OXXO/i);
  assert.equal(r.intelligence.merchantIdentity.relationship,'brand_and_legal_entity');
});

test('top display header can remain merchant while legal company is preserved separately',()=>{
  const r=parseReceiptText('ESTACION DEL NORTE\nOPERADORA SAGUARO BAJA SA DE CV\nPERMISO C.R.E. PL-123\nTOTAL 100.00');
  assert.equal(r.merchant.value,'ESTACION DEL NORTE');
  assert.match(r.intelligence.merchantIdentity.legalEntity.value,/OPERADORA SAGUARO BAJA/i);
});

test('field policy is explicit by document type',()=>{
  assert.equal(receiptTypeFieldPolicy('bank_transfer').subtotal,'not_expected');
  assert.equal(receiptTypeFieldPolicy('cfdi_invoice').tax,'important');
  assert.equal(receiptTypeFieldPolicy('retail_receipt').subtotal,'important');
});

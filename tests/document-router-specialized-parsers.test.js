import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';
import {routeSpecializedDocument} from '../features/documents/document-router.js';

test('gas station routes to specialized parser and extracts CRE/liters/price',()=>{
  const r=parseReceiptText('ESTACION DEL NORTE\nPERMISO C.R.E. PL-6534-EXP/ES-2015\nMAGNA\nLITROS 30.500\nPRECIO POR LITRO $19.67\nTOTAL 599.94');
  assert.equal(r.specialized.routed,true);
  assert.equal(r.specialized.parserId,'gas-station-v1');
  assert.equal(r.specialized.fields.crePermit.value,'PL-6534-EXP/ES-2015');
  assert.equal(r.specialized.fields.fuelProduct.value,'MAGNA');
  assert.equal(r.specialized.fields.liters.value,30.5);
  assert.equal(r.specialized.fields.pricePerLiter.value,1967);
  assert.equal(r.total.value,59994);
});

test('gas station specialized arithmetic stays candidate-only and does not replace TOTAL',()=>{
  const r=parseReceiptText('ESTACION DEL NORTE\nPERMISO C.R.E. PL-1\nLITROS 10.000\nPRECIO POR LITRO 20.00');
  assert.equal(r.total.value,null);
  const c=r.specialized.checks.find(x=>x.id==='liters-price-amount-candidate');
  assert.equal(c.status,'candidate_only');
  assert.equal(c.expectedMinor,20000);
});

test('CFDI routes to parser and extracts fiscal fields',()=>{
  const r=parseReceiptText('COMERCIALIZADORA NORTE SA DE CV\nRFC EMISOR ABC010101AA1\nCFDI 4.0\nFOLIO FISCAL 550E8400-E29B-41D4-A716-446655440000\nREGIMEN FISCAL 601 GENERAL DE LEY PERSONAS MORALES\nUSO CFDI G03 - GASTOS EN GENERAL\nTOTAL 116.00');
  assert.equal(r.specialized.routed,true);
  assert.equal(r.specialized.parserId,'cfdi-v1');
  assert.equal(r.specialized.fields.issuerRfc.value,'ABC010101AA1');
  assert.equal(r.specialized.fields.uuid.value,'550E8400-E29B-41D4-A716-446655440000');
  assert.match(r.specialized.fields.fiscalRegime.value,/601/);
  assert.match(r.specialized.fields.cfdiUse.value,/G03/);
});

test('bank transfer extracts parties banks tracking reference amount and account last4',()=>{
  const r=parseReceiptText('TRANSFERENCIA SPEI\nORDENANTE: JUAN PEREZ\nBENEFICIARIO: COMERCIAL MX\nBANCO EMISOR: BBVA\nBANCO RECEPTOR: BANORTE\nCLAVE DE RASTREO: ABC-123-XYZ\nREFERENCIA: 998877\nIMPORTE: $1,234.56\nCLABE: 012345678901234567');
  assert.equal(r.receiptType.type,'bank_transfer');
  assert.equal(r.specialized.parserId,'bank-transfer-v1');
  assert.equal(r.specialized.fields.sender.value,'JUAN PEREZ');
  assert.equal(r.specialized.fields.receiver.value,'COMERCIAL MX');
  assert.equal(r.specialized.fields.senderBank.value,'BBVA');
  assert.equal(r.specialized.fields.receiverBank.value,'BANORTE');
  assert.equal(r.specialized.fields.trackingKey.value,'ABC-123-XYZ');
  assert.equal(r.specialized.fields.reference.value,'998877');
  assert.equal(r.specialized.fields.amount.value,123456);
  assert.equal(r.specialized.fields.accountLast4.value,'4567');
  assert.equal(r.total.value,null);
});

test('restaurant parser extracts tip table server and guest count',()=>{
  const r=parseReceiptText('LA TERRAZA\nMESA 12\nMESERO JUAN\nCOMENSALES 4\nSUBTOTAL 300.00\nIVA 48.00\nPROPINA 30.00\nTOTAL 378.00');
  assert.equal(r.specialized.parserId,'restaurant-v1');
  assert.equal(r.specialized.fields.tip.value,3000);
  assert.equal(r.specialized.fields.table.value,'12');
  assert.equal(r.specialized.fields.server.value,'JUAN');
  assert.equal(r.specialized.fields.guests.value,4);
  assert.equal(r.total.value,37800);
});

test('retail receipt remains on general parser with no specialized parser',()=>{
  const r=parseReceiptText('MI TIENDA\nTOTAL DE ARTICULOS 4\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00');
  assert.equal(r.receiptType.type,'retail_receipt');
  assert.equal(r.specialized.routed,false);
  assert.equal(r.specialized.reason,'NO_SPECIALIZED_PARSER');
  assert.deepEqual(r.specialized.fields,{});
});

test('unknown low-confidence document does not route even if parser name is manually supplied weakly',()=>{
  const r=routeSpecializedDocument({text:'MESA 12',receiptType:{type:'restaurant',confidence:.4}});
  assert.equal(r.routed,false);
  assert.equal(r.reason,'TYPE_CONFIDENCE_TOO_LOW');
});

test('specialized parser cannot overwrite base receipt TOTAL or IVA',()=>{
  const r=parseReceiptText('LA TERRAZA\nMESA 1\nPROPINA 50.00\nSUBTOTAL 100.00\nIVA 16.00\nTOTAL 166.00');
  assert.equal(r.total.value,16600);
  assert.equal(r.tax.value,1600);
  assert.equal(r.specialized.fields.tip.value,5000);
  assert.equal('total' in r.specialized.fields,false);
  assert.equal('tax' in r.specialized.fields,false);
});

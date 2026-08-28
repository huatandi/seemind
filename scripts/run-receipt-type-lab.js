import {parseReceiptText} from '../features/receipt/receipt-parser.js';

const cases=[
 ['oxxo','OXXO\nRFC ABC010101AA1\nTOTAL 100.00',r=>r.receiptType.type==='convenience_store'&&r.merchant.value==='OXXO'],
 ['gas','ESTACION DEL NORTE\nPERMISO C.R.E. PL-123\nMAGNA\nLITROS 30\nTOTAL 600.00',r=>r.receiptType.type==='gas_station'],
 ['cfdi','COMERCIALIZADORA DEL NORTE SA DE CV\nRFC ABC010101AA1\nCFDI 4.0\nFOLIO FISCAL 123\nTOTAL 116.00',r=>r.receiptType.type==='cfdi_invoice'],
 ['transfer','TRANSFERENCIA SPEI\nCLAVE DE RASTREO ABC123\nBANCO RECEPTOR BBVA',r=>r.receiptType.type==='bank_transfer'&&r.total.value==null],
 ['restaurant','LA TERRAZA\nMESA 12\nMESERO JUAN\nSUBTOTAL 300.00\nIVA 48.00\nTOTAL 348.00',r=>r.receiptType.type==='restaurant'&&r.merchant.value==='LA TERRAZA'],
 ['unknown','GRACIAS POR SU COMPRA\nFOLIO 123',r=>r.receiptType.type==='unknown'&&r.merchant.value==null],
];
let passed=0,failed=[];
for(const [id,text,check] of cases){
 const r=parseReceiptText(text);
 if(check(r))passed++;else failed.push({id,type:r.receiptType,merchant:r.merchant});
}
console.log(JSON.stringify({suite:'Merchant & Receipt-Type Intelligence Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

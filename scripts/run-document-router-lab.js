import {parseReceiptText} from '../features/receipt/receipt-parser.js';

const cases=[
 ['gas','ESTACION DEL NORTE\nPERMISO C.R.E. PL-6534-EXP/ES-2015\nMAGNA\nLITROS 30.5\nPRECIO POR LITRO 19.67\nTOTAL 599.94',r=>r.specialized.parserId==='gas-station-v1'&&r.specialized.fields.liters.value===30.5],
 ['cfdi','COMERCIALIZADORA NORTE SA DE CV\nRFC EMISOR ABC010101AA1\nCFDI 4.0\nFOLIO FISCAL 550E8400-E29B-41D4-A716-446655440000\nTOTAL 116.00',r=>r.specialized.parserId==='cfdi-v1'&&r.specialized.fields.uuid.value],
 ['spei','TRANSFERENCIA SPEI\nORDENANTE: JUAN\nBENEFICIARIO: MARIA\nBANCO RECEPTOR: BBVA\nCLAVE DE RASTREO: ABC123\nIMPORTE: 500.00',r=>r.specialized.parserId==='bank-transfer-v1'&&r.specialized.fields.trackingKey.value==='ABC123'],
 ['restaurant','LA TERRAZA\nMESA 12\nMESERO JUAN\nPROPINA 30.00\nTOTAL 330.00',r=>r.specialized.parserId==='restaurant-v1'&&r.specialized.fields.tip.value===3000],
 ['retail','MI TIENDA\nTOTAL DE ARTICULOS 2\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00',r=>r.specialized.routed===false&&r.total.value===10800],
];
let passed=0,failed=[];
for(const [id,text,check] of cases){
 const r=parseReceiptText(text);
 if(check(r))passed++;else failed.push({id,type:r.receiptType,specialized:r.specialized});
}
console.log(JSON.stringify({suite:'Document Router / Specialized Parsers Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

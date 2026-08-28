import {parseReceiptText} from '../features/receipt/receipt-parser.js';

const cases=[
  ['retail','EL FLORIDO\nTOTAL DE ARTICULOS 3\nFECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00',r=>r.facts.index['money.total'].value===10800&&r.facts.index['identity.merchant'].value==='EL FLORIDO'],
  ['bank','TRANSFERENCIA SPEI\nORDENANTE: JUAN\nBENEFICIARIO: MARIA\nBANCO RECEPTOR: BBVA\nCLAVE DE RASTREO: ABC123\nIMPORTE: 500.00',r=>r.facts.index['parties.sender'].value==='JUAN'&&r.facts.index['banking.trackingKey'].value==='ABC123'],
  ['cfdi','COMERCIALIZADORA NORTE SA DE CV\nRFC EMISOR ABC010101AA1\nCFDI 4.0\nFOLIO FISCAL 550E8400-E29B-41D4-A716-446655440000\nTOTAL 116.00',r=>r.facts.index['fiscal.issuerRfc'].value==='ABC010101AA1'],
  ['gas','ESTACION DEL NORTE\nPERMISO C.R.E. PL-1\nMAGNA\nLITROS 30.5\nPRECIO POR LITRO 19.67\nTOTAL 599.94',r=>r.facts.index['domain.liters'].unit==='L'&&r.facts.index['domain.pricePerLiter'].value===1967],
  ['policy','TOTAL 100.00',r=>r.facts.policy.noAccountingClassification&&r.facts.policy.noIncomeExpenseInference&&r.facts.policy.noAutoPosting],
];
let passed=0,failed=[];
for(const [id,text,check] of cases){
  const r=parseReceiptText(text);
  if(check(r))passed++; else failed.push({id,facts:r.facts});
}
console.log(JSON.stringify({suite:'Universal Structured Facts Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

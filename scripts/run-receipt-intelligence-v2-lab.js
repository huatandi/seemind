import {parseReceiptText} from '../features/receipt/receipt-parser.js';

const cases=[
  ['supported', 'EL FLORIDO\nFECHA 20 DE AGOSTO DE 2026\nSUBTOTAL 100.00\nIVA 8% 8.00\nTOTAL 108.00\nEFECTIVO 120.00\nCAMBIO 12.00', r=>r.total.value===10800&&r.intelligence.totalAssessment.status==='supported'],
  ['candidate-only','EFECTIVO 700.00\nCAMBIO 43.62',r=>r.total.value==null&&r.intelligence.totalAssessment.suggestedCandidates.includes(65638)&&r.intelligence.totalAssessment.mayAutoFill===false],
  ['iva-conflict','SUBTOTAL 100.00\nIVA 8% 12.00\nTOTAL 112.00',r=>r.tax.value===1200&&r.checks.some(x=>x.id==='subtotal-iva-rate-tax'&&x.status==='conflicted')],
  ['currency-5','SUBTOTAL 647.51\nIVA 8.87\nTOTAL 5656.38\nEFECTIVO 700.00\nCAMBIO 43.62',r=>r.total.value===65638&&r.total.rule==='SEMANTIC_CURRENCY_5_RECOVERY'],
  ['legit-5','TOTAL 5656.38',r=>r.total.value===565638&&r.total.rule!=='SEMANTIC_CURRENCY_5_RECOVERY'],
];
let passed=0,failed=[];
for(const [id,text,check] of cases){
  const r=parseReceiptText(text);
  if(check(r))passed++;else failed.push({id,total:r.total,tax:r.tax,intelligence:r.intelligence});
}
console.log(JSON.stringify({suite:'Receipt Intelligence v2 Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

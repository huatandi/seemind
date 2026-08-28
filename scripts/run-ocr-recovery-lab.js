import {normalizeOcrText} from '../core/ocr/ocr-normalizer.js';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';

const cases=[
 ['label-o0','T0TAL 656.38',r=>r.total.value===65638],
 ['label-iva','1VA 8.87\nTOTAL 8.87',r=>r.tax.value===887],
 ['cash-o0','EFECT1V0 7O0.00\nCAMB10 43.62\nTOTAL 656.38',r=>r.cash.value===70000&&r.change.value===4362],
 ['spaced-total','T O T A L 100.00',r=>r.total.value===10000],
 ['split-subtotal','SUB\nTOTAL 100.00\nIVA 8.00\nTOTAL 108.00',r=>r.subtotal.value===10000&&r.total.value===10800],
 ['no-invent-total','EFECT1V0 700.00\nCAMB10 43.62',r=>r.total.value==null],
 ['merchant-safe','OXXO\nTOTAL $7O.OO',r=>r.merchant.value==='OXXO'&&r.total.value===7000],
 ['folio-safe','FOLIO OIIO\nTOTAL 10.00',r=>r.total.value===1000],
 ['duplicate-header','EL FLORIDO\nEL FLORIDO\nTOTAL 10.00',r=>r.merchant.value==='EL FLORIDO'],
 ['duplicate-iva-preserved','IVA 8.00\nIVA 8.00\nTOTAL 16.00',r=>r.tax.value===1600],
 ['raw-trace','T0TAL $7O.OO',(_r,n)=>n.rawText==='T0TAL $7O.OO'&&n.transformations.length>=2],
 ['noisy-summary','SUBT0TAL 647.51\n1VA 8% 8.87\nT0TAL $656.38\nEFECT1V0 7O0.00\nCAMB10 43.62',r=>r.total.value===65638&&r.cash.value===70000],
];
let passed=0;const failed=[];
for(const [id,raw,check] of cases){
 const n=normalizeOcrText(raw);const r=parseReceiptText(n.normalizedText);
 if(check(r,n))passed++;else failed.push({id,raw,normalized:n.normalizedText});
}
console.log(JSON.stringify({suite:'OCR Receipt Recovery Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

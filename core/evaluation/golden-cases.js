import {GoldenDataset} from './golden-dataset.js';

export function createCoreGoldenDataset(){
  return new GoldenDataset([
    {id:'receipt-mx-subtotal-iva-total',task:'receipt',critical:true,tags:['mexico','receipt','money'],input:{text:'SUBTOTAL 647.51\nIVA 8% 8.87\nTOTAL $656.38\nEFECTIVO 700.00\nCAMBIO 43.62'},expected:{subtotal:{value:64751},tax:{value:887},total:{value:65638},cash:{value:70000},change:{value:4362}}},
    {id:'receipt-no-total-no-guess',task:'receipt',critical:true,tags:['mexico','receipt','unknown'],input:{text:'EFECTIVO 700.00\nCAMBIO 43.62'},expected:{total:{value:null,status:'unresolved'}}},
    {id:'receipt-currency-5-recovery',task:'receipt',critical:true,tags:['mexico','receipt','ocr'],input:{text:'SUBTOTAL 647.51\nIVA 8% 8.87\nTOTAL 5656.38\nEFECTIVO 700.00\nCAMBIO 43.62'},expected:{total:{value:65638,rule:'SEMANTIC_CURRENCY_5_RECOVERY'}}},
    {id:'receipt-legitimate-leading-5',task:'receipt',critical:true,tags:['mexico','receipt','ocr'],input:{text:'TOTAL 5656.38\nEFECTIVO 5700.00\nCAMBIO 43.62'},expected:{total:{value:565638}}},
    {id:'receipt-date-spanish-month',task:'receipt',tags:['mexico','receipt','date'],input:{text:'FECHA 20AGO2026'},expected:{date:{value:'2026-08-20'}}},
    {id:'fresh-current-price-requires-search',task:'freshness',critical:true,tags:['freshness','price'],input:{intent:'current_price'},expected:{requiresSearch:true}},
    {id:'evidence-current-fact-needs-search',task:'evidence',critical:true,tags:['freshness','evidence'],input:{scenario:'current_fact_without_search'},expected:{accepted:false}},
    {id:'teacher-unsupported-fact-rejected',task:'teacher',critical:true,tags:['teacher','evidence'],input:{scenario:'unsupported_fact'},expected:{accepted:false}},
    {id:'planner-identity-before-price-search',task:'planner',critical:true,tags:['identity','search'],input:{scenario:'uncertain_identity_price'},expected:{searchBeforeIdentity:false}},
    {id:'recovery-completed-node-not-replayed',task:'recovery',critical:true,tags:['recovery','idempotency'],input:{scenario:'completed_receipt'},expected:{replayed:false}},
  ]);
}

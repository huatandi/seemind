import {createAnnotationDraft,confirmAnnotationField,submitAnnotationForReview,reviewAnnotation} from '../core/evaluation/receipt-corpus/annotation-workflow.js';
import {validateReceiptCorpusCase} from '../core/evaluation/receipt-corpus/corpus-validator.js';

const obs={extractedText:'TIENDA\nTOTAL 108.00',observations:[
 {kind:'ocr',rawText:'TIENDA\nTOTAL 108.00'},
 {kind:'receipt_fields',receipt:{merchant:{value:'TIENDA',confidence:.55},date:{value:'2026-08-20',confidence:.95},subtotal:{value:10000,confidence:.92},tax:{value:800,confidence:.92},discount:{value:null},total:{value:10800,confidence:.97},cash:{value:null},change:{value:null}}}
]};
let d=createAnnotationDraft({caseId:'lab-1',imageRef:'images/lab-1.redacted.jpg',studentObservation:obs,annotatorId:'annotator'});
for(const [k,v,status] of [['merchant','TIENDA','confirmed'],['date','2026-08-20','confirmed'],['subtotal',10000,'confirmed'],['tax',800,'confirmed'],['discount',null,'not_applicable'],['total',10800,'confirmed'],['cash',null,'not_applicable'],['change',null,'not_applicable']]){
 d=confirmAnnotationField(d,k,{value:v,status});
}
d=submitAnnotationForReview(d,{consentConfirmed:true,imageRedactionConfirmed:true});
d=reviewAnnotation(d,{reviewerId:'reviewer',decision:'approve'});
const valid=validateReceiptCorpusCase(d,{strict:true}).valid;
console.log(JSON.stringify({suite:'Real Corpus Annotation Workflow Lab',stage:d.workflow.stage,studentSuggestionOnly:d.workflow.studentSuggestionOnly,benchmarkEligible:valid,score:valid&&d.workflow.stage==='eligible'?100:0},null,2));

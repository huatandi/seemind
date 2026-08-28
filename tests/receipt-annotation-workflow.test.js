import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnnotationDraft,confirmAnnotationField,submitAnnotationForReview,reviewAnnotation,annotationProgress} from '../core/evaluation/receipt-corpus/annotation-workflow.js';
import {ReceiptCorpusIntakeSession} from '../core/evaluation/receipt-corpus/intake-session.js';
import {validateReceiptCorpusCase} from '../core/evaluation/receipt-corpus/corpus-validator.js';

function obs(){
 return {extractedText:'TIENDA\nRFC ABC010101AA1\nTOTAL 108.00',observations:[
  {kind:'ocr',rawText:'TIENDA\nRFC ABC010101AA1\nTOTAL 108.00'},
  {kind:'receipt_fields',receipt:{
   merchant:{value:'TIENDA',confidence:.55,rule:'HEADER_CANDIDATE',sourceText:'TIENDA'},
   date:{value:'2026-08-20',confidence:.95,rule:'ISO_DATE_MATCH'},
   subtotal:{value:10000,confidence:.92,rule:'LABEL_AMOUNT_MATCH'},
   tax:{value:800,confidence:.92,rule:'LABEL_AMOUNT_MATCH'},
   discount:{value:null,confidence:0,rule:'UNRESOLVED'},
   total:{value:10800,confidence:.97,rule:'LABEL_AMOUNT_MATCH'},
   cash:{value:null,confidence:0},change:{value:null,confidence:0}
  }}
 ]};
}

test('Student values become suggestions, never automatically confirmed Ground Truth',()=>{
 const d=createAnnotationDraft({caseId:'r1',imageRef:'images/r1.redacted.jpg',studentObservation:obs()});
 assert.equal(d.fields.total.value,10800);
 assert.equal(d.fields.total.status,'unresolved');
 assert.equal(d.fields.total.suggestion.value,10800);
 assert.equal(d.workflow.studentSuggestionOnly,true);
});

test('annotation draft records sensitive OCR finding types without storing extra secret copy',()=>{
 const d=createAnnotationDraft({caseId:'r1',imageRef:'x',studentObservation:obs()});
 assert.equal(d.workflow.sensitiveTextFindingCount,1);
 assert.deepEqual(d.workflow.sensitiveTextFindingTypes,['rfc']);
});

test('annotator can confirm or correct Student suggestion',()=>{
 let d=createAnnotationDraft({caseId:'r1',imageRef:'x',studentObservation:obs(),annotatorId:'a1'});
 d=confirmAnnotationField(d,'total',{value:10900,status:'confirmed'});
 assert.equal(d.fields.total.value,10900);
 assert.equal(d.fields.total.suggestion.value,10800);
 assert.equal(d.fields.total.status,'confirmed');
});

test('critical date and total must be human-resolved before review submission',()=>{
 let d=createAnnotationDraft({caseId:'r1',imageRef:'x',studentObservation:obs(),annotatorId:'a1'});
 assert.throws(()=>submitAnnotationForReview(d,{consentConfirmed:true,imageRedactionConfirmed:true}),/CRITICAL_FIELDS_UNRESOLVED/);
});

test('review submission requires consent and image-redaction confirmation',()=>{
 let d=createAnnotationDraft({caseId:'r1',imageRef:'x',studentObservation:obs(),annotatorId:'a1'});
 d=confirmAnnotationField(d,'date',{value:'2026-08-20'});
 d=confirmAnnotationField(d,'total',{value:10800});
 assert.throws(()=>submitAnnotationForReview(d,{consentConfirmed:false,imageRedactionConfirmed:true}),/CONSENT_CONFIRMATION_REQUIRED/);
 assert.throws(()=>submitAnnotationForReview(d,{consentConfirmed:true,imageRedactionConfirmed:false}),/IMAGE_REDACTION_CONFIRMATION_REQUIRED/);
});

test('reviewer approval creates benchmark-eligible reviewed case',()=>{
 let d=createAnnotationDraft({caseId:'r1',imageRef:'images/r1.redacted.jpg',studentObservation:obs(),annotatorId:'a1'});
 for(const [k,v] of Object.entries({merchant:'TIENDA',date:'2026-08-20',subtotal:10000,tax:800,total:10800})){
   d=confirmAnnotationField(d,k,{value:v,status:'confirmed'});
 }
 d=confirmAnnotationField(d,'discount',{value:null,status:'not_applicable'});
 d=confirmAnnotationField(d,'cash',{value:null,status:'not_applicable'});
 d=confirmAnnotationField(d,'change',{value:null,status:'not_applicable'});
 d=submitAnnotationForReview(d,{consentConfirmed:true,imageRedactionConfirmed:true});
 assert.equal(d.workflow.stage,'review');
 d=reviewAnnotation(d,{reviewerId:'r1',decision:'approve'});
 assert.equal(d.workflow.stage,'eligible');
 assert.equal(d.annotation.status,'reviewed');
 assert.equal(validateReceiptCorpusCase(d,{strict:true}).valid,true);
});

test('reviewer can reject case back to annotation instead of silently fixing truth',()=>{
 let d=createAnnotationDraft({caseId:'r1',imageRef:'x',studentObservation:obs(),annotatorId:'a1'});
 d=confirmAnnotationField(d,'date',{value:'2026-08-20'});
 d=confirmAnnotationField(d,'total',{value:10800});
 d=submitAnnotationForReview(d,{consentConfirmed:true,imageRedactionConfirmed:true});
 d=reviewAnnotation(d,{reviewerId:'r1',decision:'reject'});
 assert.equal(d.workflow.stage,'annotation');
 assert.equal(d.annotation.status,'draft');
});

test('annotation progress exposes unresolved work',()=>{
 let d=createAnnotationDraft({caseId:'r1',imageRef:'x',studentObservation:obs()});
 d=confirmAnnotationField(d,'date',{value:'2026-08-20'});
 const p=annotationProgress(d);
 assert.equal(p.confirmed,1);assert.ok(p.unresolved.includes('total'));
});

test('intake session rejects duplicate case IDs and summarizes workflow stages',()=>{
 const s=new ReceiptCorpusIntakeSession({sessionId:'s1',annotatorId:'a1'});
 s.add({caseId:'a',imageRef:'a.jpg',studentObservation:obs()});
 s.add({caseId:'b',imageRef:'b.jpg',studentObservation:obs()});
 assert.throws(()=>s.add({caseId:'a',imageRef:'x.jpg',studentObservation:obs()}),/INTAKE_DUPLICATE_CASE/);
 assert.deepEqual(s.summary(),{sessionId:'s1',count:2,byStage:{annotation:2}});
});

test('strict corpus eligibility now also requires consent and redaction',()=>{
 const c={caseId:'x',imageRef:'x',difficulty:'unknown',
  fields:Object.fromEntries(['merchant','date','subtotal','tax','discount','total','cash','change'].map(k=>[k,{value:null,status:'not_applicable'}])),
  annotation:{status:'reviewed',reviewedBy:'r'},provenance:{consentConfirmed:false,redacted:false}};
 const v=validateReceiptCorpusCase(c,{strict:true});
 assert.ok(v.errors.includes('CONSENT_REQUIRED_FOR_BENCHMARK'));
 assert.ok(v.errors.includes('REDACTION_REQUIRED_FOR_BENCHMARK'));
});

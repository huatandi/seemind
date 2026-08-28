import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnnotationDraft} from '../core/evaluation/receipt-corpus/annotation-workflow.js';
import {annotationConsoleRows,acceptSuggestion,applyConsoleValue,markNotApplicable,formatGroundTruthValue,annotationConsoleSummary} from '../core/evaluation/receipt-corpus/annotation-console.js';

function obs(){
 return {observations:[{kind:'receipt_fields',receipt:{
  merchant:{value:'TIENDA',confidence:.55,rule:'HEADER_CANDIDATE'},
  date:{value:'2026-08-20',confidence:.95,rule:'ISO_DATE_MATCH'},
  subtotal:{value:10000,confidence:.92},tax:{value:800,confidence:.92},discount:{value:null,confidence:0},
  total:{value:10800,confidence:.97},cash:{value:null,confidence:0},change:{value:null,confidence:0}
 }}]};
}

test('annotation console exposes expected Mexican receipt field order',()=>{
 const d=createAnnotationDraft({caseId:'x',imageRef:'x.jpg',studentObservation:obs()});
 const rows=annotationConsoleRows(d);
 assert.deepEqual(rows.map(x=>x.label),['COMERCIO','FECHA','SUBTOTAL','IVA','DESCUENTO','TOTAL','EFECTIVO','CAMBIO']);
});

test('accept suggestion is an explicit human action',()=>{
 const d=createAnnotationDraft({caseId:'x',imageRef:'x.jpg',studentObservation:obs()});
 assert.equal(d.fields.total.status,'unresolved');
 const next=acceptSuggestion(d,'total',{annotatorId:'a'});
 assert.equal(next.fields.total.status,'confirmed');
 assert.equal(next.fields.total.value,10800);
});

test('manual money editing converts display currency to centavos',()=>{
 const d=createAnnotationDraft({caseId:'x',imageRef:'x.jpg',studentObservation:obs()});
 const next=applyConsoleValue(d,'total','$656.38',{annotatorId:'a'});
 assert.equal(next.fields.total.value,65638);
 assert.equal(next.fields.total.status,'confirmed');
});

test('comma decimal manual money entry is accepted',()=>{
 const d=createAnnotationDraft({caseId:'x',imageRef:'x.jpg',studentObservation:obs()});
 const next=applyConsoleValue(d,'tax','8,87');
 assert.equal(next.fields.tax.value,887);
});

test('mark not applicable does not fabricate zero',()=>{
 const d=createAnnotationDraft({caseId:'x',imageRef:'x.jpg',studentObservation:obs()});
 const next=markNotApplicable(d,'discount');
 assert.equal(next.fields.discount.value,null);
 assert.equal(next.fields.discount.status,'not_applicable');
});

test('formatting money uses two decimal display without mutating centavos',()=>{
 assert.equal(formatGroundTruthValue('total',65638),'656.38');
 assert.equal(formatGroundTruthValue('date','2026-08-20'),'2026-08-20');
});

test('console summary keeps critical readiness separate from overall completeness',()=>{
 let d=createAnnotationDraft({caseId:'x',imageRef:'x.jpg',studentObservation:obs()});
 d=acceptSuggestion(d,'date'); d=acceptSuggestion(d,'total');
 const s=annotationConsoleSummary(d);
 assert.equal(s.criticalReady,true);
 assert.ok(s.unresolved.includes('merchant'));
});

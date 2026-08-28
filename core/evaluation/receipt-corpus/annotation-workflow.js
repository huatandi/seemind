import {normalizeGroundTruth,RECEIPT_GT_FIELDS} from './ground-truth-schema.js';
import {scanReceiptTextForSensitiveData} from './pii-redaction.js';
import {validateReceiptCorpusCase} from './corpus-validator.js';

export function createAnnotationDraft({caseId,imageRef,studentObservation,receiptType='unknown',difficulty='unknown',annotatorId=null,provenance={}}={}){
  const receipt=findReceipt(studentObservation);
  const ocrText=findOcrText(studentObservation);
  const fields={};
  for(const key of RECEIPT_GT_FIELDS){
    const evidence=receipt?.[key];
    fields[key]={
      value:evidence?.value??null,
      status:'unresolved',
      suggestion:{
        value:evidence?.value??null,
        confidence:Number(evidence?.confidence??0)||0,
        rule:evidence?.rule??null,
        sourceText:evidence?.sourceText??null,
      },
    };
  }
  const sensitive=scanReceiptTextForSensitiveData(ocrText);
  const canonical=normalizeGroundTruth({
      caseId,imageRef,receiptType,difficulty,
      fields:Object.fromEntries(RECEIPT_GT_FIELDS.map(k=>[k,{value:fields[k].value,status:'unresolved'}])),
      annotation:{status:'draft',annotatorId},
      provenance:{source:provenance.source??'user-provided',capturedAt:provenance.capturedAt??null,consentConfirmed:Boolean(provenance.consentConfirmed),redacted:false},
    });
  for(const k of RECEIPT_GT_FIELDS)canonical.fields[k].suggestion=fields[k].suggestion;
  return normalizeAnnotation({
    ...canonical,
    workflow:{
      stage:'annotation',
      studentSuggestionOnly:true,
      sensitiveTextFindingCount:sensitive.length,
      sensitiveTextFindingTypes:[...new Set(sensitive.map(x=>x.type))],
      createdAt:new Date().toISOString(),
    },
  });
}

export function confirmAnnotationField(draft,field,{value,status='confirmed',annotatorId=null}={}){
  requireStage(draft,'annotation');
  if(!RECEIPT_GT_FIELDS.includes(field))throw new Error(`UNKNOWN_GROUND_TRUTH_FIELD:${field}`);
  if(!['confirmed','unresolved','not_applicable'].includes(status))throw new Error('INVALID_ANNOTATION_FIELD_STATUS');
  const next=clone(draft);
  next.fields[field]={...next.fields[field],value:value??null,status};
  if(annotatorId)next.annotation.annotatorId=String(annotatorId);
  next.workflow.updatedAt=new Date().toISOString();
  return next;
}

export function submitAnnotationForReview(draft,{annotatorId=null,consentConfirmed=false,imageRedactionConfirmed=false}={}){
  requireStage(draft,'annotation');
  const next=clone(draft);
  if(annotatorId)next.annotation.annotatorId=String(annotatorId);
  next.provenance.consentConfirmed=Boolean(consentConfirmed);
  next.provenance.redacted=Boolean(imageRedactionConfirmed);
  const unresolved=RECEIPT_GT_FIELDS.filter(k=>next.fields[k]?.status==='unresolved');
  if(!next.annotation.annotatorId)throw new Error('ANNOTATOR_REQUIRED');
  if(unresolved.includes('total')||unresolved.includes('date'))throw new Error(`CRITICAL_FIELDS_UNRESOLVED:${unresolved.filter(x=>x==='total'||x==='date').join(',')}`);
  if(!next.provenance.consentConfirmed)throw new Error('CONSENT_CONFIRMATION_REQUIRED');
  if(!next.provenance.redacted)throw new Error('IMAGE_REDACTION_CONFIRMATION_REQUIRED');
  next.annotation.status='submitted';
  next.workflow.stage='review';
  next.workflow.submittedAt=new Date().toISOString();
  return next;
}

export function reviewAnnotation(submitted,{reviewerId,decision='approve',corrections={}}={}){
  requireStage(submitted,'review');
  if(!reviewerId)throw new Error('REVIEWER_REQUIRED');
  const next=clone(submitted);
  for(const [field,value] of Object.entries(corrections)){
    if(!RECEIPT_GT_FIELDS.includes(field))throw new Error(`UNKNOWN_GROUND_TRUTH_FIELD:${field}`);
    next.fields[field]={...next.fields[field],value:value??null,status:'confirmed'};
  }
  if(decision==='reject'){
    next.annotation.status='draft';next.annotation.reviewedBy=String(reviewerId);
    next.workflow.stage='annotation';next.workflow.reviewDecision='rejected';next.workflow.reviewedAt=new Date().toISOString();
    return next;
  }
  if(decision!=='approve')throw new Error('INVALID_REVIEW_DECISION');
  next.annotation.status='reviewed';
  next.annotation.reviewedBy=String(reviewerId);
  next.annotation.reviewedAt=new Date().toISOString();
  next.workflow.stage='eligible';
  next.workflow.reviewDecision='approved';
  next.workflow.reviewedAt=next.annotation.reviewedAt;
  const validation=validateReceiptCorpusCase(next,{strict:true});
  if(!validation.valid)throw Object.assign(new Error('REVIEWED_CASE_INVALID'),{validation});
  return next;
}

export function annotationProgress(draft){
  const confirmed=RECEIPT_GT_FIELDS.filter(k=>draft?.fields?.[k]?.status==='confirmed').length;
  const unresolved=RECEIPT_GT_FIELDS.filter(k=>draft?.fields?.[k]?.status==='unresolved');
  return {confirmed,total:RECEIPT_GT_FIELDS.length,ratio:confirmed/RECEIPT_GT_FIELDS.length,unresolved,stage:draft?.workflow?.stage??'unknown'};
}

function findReceipt(obs){return obs?.observations?.find(x=>x.kind==='receipt_fields')?.receipt??null}
function findOcrText(obs){return obs?.observations?.find(x=>x.kind==='ocr')?.rawText??obs?.extractedText??''}
function requireStage(x,s){if(x?.workflow?.stage!==s)throw new Error(`ANNOTATION_STAGE_REQUIRED:${s}`)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function normalizeAnnotation(v){
  // Keep Student output as separate suggestion metadata. It must never change
  // the canonical field status from unresolved to confirmed.
  const suggestions=Object.fromEntries(RECEIPT_GT_FIELDS.map(k=>[k,v.fields?.[k]?.suggestion??null]));
  const canonical=normalizeGroundTruth({
    ...v,
    fields:Object.fromEntries(RECEIPT_GT_FIELDS.map(k=>[
      k,{value:v.fields?.[k]?.value??null,status:v.fields?.[k]?.status??'unresolved'}
    ])),
  });
  for(const k of RECEIPT_GT_FIELDS)canonical.fields[k].suggestion=suggestions[k];
  canonical.workflow=v.workflow;
  return canonical;
}

export const RECEIPT_GROUND_TRUTH_SCHEMA_VERSION=1;
export const RECEIPT_GT_FIELDS=['merchant','date','subtotal','tax','discount','total','cash','change'];

export function normalizeGroundTruth(input={}){
  const fields={};
  for(const key of RECEIPT_GT_FIELDS)fields[key]=normalizeField(input.fields?.[key]??input[key]);
  return {
    schemaVersion:RECEIPT_GROUND_TRUTH_SCHEMA_VERSION,
    caseId:String(input.caseId??input.id??''),
    imageRef:String(input.imageRef??''),
    receiptType:String(input.receiptType??'unknown'),
    difficulty:String(input.difficulty??'unknown'),
    locale:String(input.locale??'es-MX'),
    currency:String(input.currency??'MXN'),
    fields,
    criticalFields:[...(input.criticalFields??['date','total'])].map(String),
    tags:[...(input.tags??[])].map(String),
    annotation:{
      status:String(input.annotation?.status??'draft'),
      annotatorId:input.annotation?.annotatorId?String(input.annotation.annotatorId):null,
      reviewedBy:input.annotation?.reviewedBy?String(input.annotation.reviewedBy):null,
      reviewedAt:input.annotation?.reviewedAt??null,
      notes:String(input.annotation?.notes??''),
    },
    provenance:{
      source:String(input.provenance?.source??'user-provided'),
      capturedAt:input.provenance?.capturedAt??null,
      consentConfirmed:Boolean(input.provenance?.consentConfirmed),
      redacted:Boolean(input.provenance?.redacted),
    },
  };
}
function normalizeField(v){
  if(v==null)return {value:null,status:'unresolved'};
  if(typeof v!=='object'||Array.isArray(v))return {value:v,status:'confirmed'};
  return {value:'value'in v?v.value:null,status:String(v.status??('value'in v?'confirmed':'unresolved')), ...(v.rule?{rule:String(v.rule)}:{})};
}

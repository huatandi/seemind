import {RECEIPT_GT_FIELDS} from './ground-truth-schema.js';

export function validateReceiptCorpusCase(c,{strict=true}={}){
  const errors=[],warnings=[];
  if(!c?.caseId)errors.push('CASE_ID_REQUIRED');
  if(!c?.imageRef)errors.push('IMAGE_REF_REQUIRED');
  if(!['easy','medium','hard','unknown'].includes(c?.difficulty))errors.push('INVALID_DIFFICULTY');
  if(!c?.fields||typeof c.fields!=='object')errors.push('FIELDS_REQUIRED');
  for(const key of RECEIPT_GT_FIELDS){
    const f=c?.fields?.[key];
    if(!f||typeof f!=='object'||!('value'in f))errors.push(`FIELD_CONTRACT:${key}`);
    if(f&&!['confirmed','unresolved','not_applicable'].includes(f.status))errors.push(`FIELD_STATUS:${key}`);
  }
  if(!['draft','submitted','reviewed'].includes(c?.annotation?.status))errors.push('INVALID_ANNOTATION_STATUS');
  if(c?.annotation?.status==='reviewed'&&!c.annotation.reviewedBy)errors.push('REVIEWER_REQUIRED');
  if(c?.annotation?.status!=='reviewed')warnings.push('GROUND_TRUTH_NOT_REVIEWED');
  if(!c?.provenance?.consentConfirmed)warnings.push('CONSENT_NOT_CONFIRMED');
  if(!c?.provenance?.redacted)warnings.push('IMAGE_REDACTION_NOT_CONFIRMED');
  const total=c?.fields?.total?.value,subtotal=c?.fields?.subtotal?.value,tax=c?.fields?.tax?.value,discount=c?.fields?.discount?.value;
  if([total,subtotal].every(Number.isInteger)&&[tax,discount].every(x=>x==null||Number.isInteger)){
    const expected=subtotal+(tax??0)-(discount??0);
    if(Math.abs(expected-total)>2)warnings.push('ARITHMETIC_GROUND_TRUTH_CONFLICT');
  }
  if(strict&&warnings.includes('GROUND_TRUTH_NOT_REVIEWED'))errors.push('REVIEW_REQUIRED_FOR_BENCHMARK');
  if(strict&&warnings.includes('CONSENT_NOT_CONFIRMED'))errors.push('CONSENT_REQUIRED_FOR_BENCHMARK');
  if(strict&&warnings.includes('IMAGE_REDACTION_NOT_CONFIRMED'))errors.push('REDACTION_REQUIRED_FOR_BENCHMARK');
  return {valid:errors.length===0,errors,warnings};
}

export function validateReceiptCorpus(cases,{strict=true}={}){
  const seen=new Set(),results=[];
  for(const c of cases??[]){
    const r=validateReceiptCorpusCase(c,{strict});
    if(seen.has(c.caseId))r.errors.push('DUPLICATE_CASE_ID');
    seen.add(c.caseId);r.valid=r.errors.length===0;
    results.push({caseId:c.caseId,...r});
  }
  return {valid:results.every(x=>x.valid),caseCount:results.length,invalidCount:results.filter(x=>!x.valid).length,results};
}

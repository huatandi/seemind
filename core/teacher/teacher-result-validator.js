import {normalizeAnswerContract} from '../answer/answer-contract.js';
import {judgeClaims} from '../evidence/claim-judge.js';
import {validateIdentityProposal} from '../entity/entity-verification.js';

export function validateTeacherResult(raw,taskPackage){
  const issues=[];
  if(!raw||typeof raw!=='object')issues.push('result_not_object');
  const value=normalizeAnswerContract(raw);
  if(!value.answer)issues.push('answer_missing');
  if(value.answer.length>12000)issues.push('answer_too_long');
  const allowed=new Set([...(taskPackage?.evidence??[]).map(e=>e.id),...(taskPackage?.media??[]).map(m=>m.id)].filter(Boolean));
  if(value.evidenceRefs.some(id=>allowed.size&&!allowed.has(id)))issues.push('unknown_evidence_ref');
  const claimJudgement=judgeClaims(value,taskPackage);
  issues.push(...claimJudgement.issues);
  value.claims=claimJudgement.claims;
  if(taskPackage?.contract?.requireIdentityProposal){
    const identity=validateIdentityProposal(value.identityProposal,taskPackage);
    issues.push(...identity.issues);
    value.identityProposal=identity.entity??value.identityProposal;
  }
  const uniqueIssues=[...new Set(issues)];
  const blockingIssues=uniqueIssues.filter(i=>!String(i).startsWith('source_conflict_resolved:'));
  return {ok:blockingIssues.length===0,issues:uniqueIssues,warnings:uniqueIssues.filter(i=>String(i).startsWith('source_conflict_resolved:')),value};
}

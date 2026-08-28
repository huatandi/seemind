import {judgeClaims} from '../evidence/claim-judge.js';
import {analyzeConsensus} from '../evidence/evidence-consensus.js';
import {evidenceQualitySummary} from '../evidence/source-quality.js';
import {createVerificationVerdict,VERIFICATION_STATUS as S} from './verification-verdict.js';

/**
 * Single acceptance authority for executor output.
 * Evidence, source-quality, freshness, conflict and Safety remain specialist checks.
 * This core aggregates their findings into one auditable verdict.
 */
export function verifyExecutionResult({envelope,context={},taskPackage=null,answer=null}={}){
 if(!envelope)return createVerificationVerdict({status:S.REJECT,reason:'result_envelope_missing'});
 if(envelope.status==='failed')return createVerificationVerdict({status:S.REJECT,reason:'execution_failed',route:envelope.route,issues:[envelope.error].filter(Boolean),nextAction:'replan_or_report_failure'});
 if(!envelope.requiresVerification)return createVerificationVerdict({status:S.NOT_REQUIRED,reason:'terminal_presentation_or_collection_action',route:envelope.route,nextAction:'continue_route_contract'});

 const pkg=taskPackage??envelope.taskPackage??{};
 const safety=context.safety?.risk??{};
 if(safety.level==='R3')return createVerificationVerdict({status:S.SAFETY_BLOCK,reason:'r3_result_cannot_authorize_hazardous_action',route:envelope.route,safety,nextAction:'protective_handoff'});

 const evidence=[...(pkg.evidence??[]),...extractEvidence(envelope.result)];
 const quality=evidenceQualitySummary(evidence,pkg.task??context.task??{});
 const consensus=analyzeConsensus(evidence,pkg.task??context.task??{});
 const candidate=answer??extractAnswer(envelope.result);
 const claimJudgment=candidate?.claims?judgeClaims(candidate,{...pkg,evidence}):null;
 const provenance=evidence.map(e=>e.provenance??({sourceId:e.id??null,url:e.url??null,publisher:e.publisher??null,sourceType:e.sourceType??e.sourceQuality?.sourceType??null,accessedAt:e.accessedAt??null,license:{id:'unknown',commercialUse:null,redistribution:null},attributionRequired:true})).filter(x=>x.sourceId||x.url);

 if(claimJudgment&&!claimJudgment.ok){
   const conflicted=claimJudgment.issues.some(x=>x.startsWith('source_conflict:')||x.startsWith('consensus_unresolved:'));
   return createVerificationVerdict({status:conflicted?S.CONFLICT:S.REJECT,reason:conflicted?'claim_sources_conflict':'claim_support_failed',route:envelope.route,claims:claimJudgment.claims,issues:claimJudgment.issues,evidenceSummary:summary(quality,consensus),safety,provenance,nextAction:conflicted?'search_more_or_report_disagreement':'collect_better_evidence_or_revise_claims'});
 }
 if(consensus.conflicts.some(c=>c.resolution.status==='unresolved'))
   return createVerificationVerdict({status:S.CONFLICT,reason:'independent_high_quality_sources_disagree',route:envelope.route,issues:consensus.conflicts.map(c=>`conflict:${c.claimKey}`),evidenceSummary:summary(quality,consensus),safety,provenance,nextAction:'search_more_or_report_disagreement'});

 const requiresExternalEvidence=['SEARCH'].includes(envelope.route);
 if(requiresExternalEvidence&&quality.usable.length===0)
   return createVerificationVerdict({status:S.NEED_MORE_EVIDENCE,reason:'no_qualified_external_evidence',route:envelope.route,evidenceSummary:summary(quality,consensus),safety,provenance,nextAction:'retrieve_better_sources'});

 if(candidate?.claims?.length&&claimJudgment?.ok)
   return createVerificationVerdict({status:S.ACCEPT,reason:'claims_supported_within_current_evidence_boundary',route:envelope.route,claims:claimJudgment.claims,evidenceSummary:summary(quality,consensus),safety,provenance,nextAction:'reenter_orchestrator'});

 if(envelope.route==='TEACHER')
   return createVerificationVerdict({status:S.ACCEPT_WITH_CAVEAT,reason:'teacher_output_is_candidate_without_structured_claims',route:envelope.route,evidenceSummary:summary(quality,consensus),safety,provenance,nextAction:'reenter_with_uncertainty_boundary'});

 return createVerificationVerdict({status:S.ACCEPT,reason:'execution_result_passed_available_checks',route:envelope.route,evidenceSummary:summary(quality,consensus),safety,provenance,nextAction:'reenter_orchestrator'});
}

export function attachVerificationToContext(context,verdict){
 return {...context,verification:{verdict,history:[...(context.verification?.history??[]),verdict]}};
}
function extractEvidence(result){return Array.isArray(result?.evidence)?result.evidence:Array.isArray(result?.results)?result.results.filter(x=>x?.id||x?.url):[]}
function extractAnswer(result){return result?.answer??(result?.claims?result:null)}
function summary(q,c){return {usableEvidence:q.usable.length,bestScore:q.bestScore,minimumScore:q.minimumScore,sourceTypes:q.sourceTypes,independentFamilies:c.independentFamilies,hasConflict:c.hasConflict,recommendation:c.recommendation,decisionAuthority:'verification_core',taskAwareEvidenceAuthority:true}}

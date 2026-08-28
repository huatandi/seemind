export function assessAnswerability({observation={},problem={},problemState={},retrievalPlan={},safety={},capabilities={}}={}){
 const perception=clamp(observation.confidence?.overall??0),known=(problemState.facts??problem.knownFacts??[]).length,unknown=(problemState.unknowns??problem.unknownFacts??[]).length;
 const hasTarget=Boolean(problemState.target||problem.referencedObjects?.some(x=>x.groundingStatus==='resolved'||x.groundedRegionId));
 const limitations=(observation.limitations??[]).length;
 const evidenceCompleteness=clamp((known+1)/(known+unknown+1)-Math.min(.35,limitations*.08));
 const localConfidence=clamp(.52*perception+.33*evidenceCompleteness+.15*(hasTarget?1:.45));
 const freshnessRequired=Boolean(retrievalPlan.needsFreshness);
 const riskLevel=safety.risk?.level??safety.level??problemState.risk?.level??'LOW';
 const specialistRequired=Boolean(safety.risk?.requiresExpert??safety.requiresExpert??problemState.risk?.requiresExpert);
 let decision='LOCAL',reason='LOCAL_EVIDENCE_ADEQUATE';
 if(riskLevel==='R3'||riskLevel==='HIGH'){decision='HUMAN';reason='HIGH_RISK_REQUIRES_PROTECTIVE_HANDOFF'}
 else if(specialistRequired){decision=Number(capabilities.teacherCount??0)>0?'TEACHER':'HUMAN';reason='SPECIALIST_REQUIRED'}
 else if(freshnessRequired){decision=capabilities.searchAvailable?'SEARCH':'STOP';reason='FRESHNESS_REQUIRES_RETRIEVAL'}
 else if(!hasTarget&&/identify|troubleshoot|solve|guide/.test(problem.intentHypotheses?.[0]?.intent??'')){decision='CLARIFY';reason='TARGET_NOT_GROUNDED'}
 else if(localConfidence<.5){decision=capabilities.searchAvailable?'SEARCH':Number(capabilities.teacherCount??0)>0?'TEACHER':'CLARIFY';reason='LOCAL_CONFIDENCE_LOW'}
 else if(evidenceCompleteness<.5&&unknown>0){decision='CLARIFY';reason='DECISIVE_EVIDENCE_MISSING'}
 return {schemaVersion:1,decision,reason,localConfidence,evidenceCompleteness,freshnessRequired,specialistRequired,riskLevel,signals:{perceptionConfidence:perception,knownFacts:known,unknownFacts:unknown,targetGrounded:hasTarget,limitations},boundary:'advisory_to_unified_orchestrator'};
}
function clamp(v){return Math.max(0,Math.min(1,Number(v)||0))}

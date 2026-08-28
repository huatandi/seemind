import {buildOrchestrationContext} from './orchestration-context.js';
import {createRouteContract} from './route-contract.js';

export const UNIFIED_ROUTES=Object.freeze({LOCAL:'LOCAL',CLARIFY:'CLARIFY',SEARCH:'SEARCH',PLAN:'PLAN',TEACHER:'TEACHER',HUMAN:'HUMAN',STOP:'STOP'});

/**
 * Final routing authority. Specialist modules keep their full process and
 * submit assessments; this function only arbitrates the next stage.
 */
export function orchestrate({context=null,task={},observation={},explanation={},capabilities={},taskPackage=null}={}){
 const c=context??buildOrchestrationContext({task,observation,explanation,capabilities,taskPackage});
 const safety=c.safety?.risk??{};
 const resolution=c.evidence?.resolution??{};
 const retrieval=c.retrieval?.plan??{};
 const request=c.evidence?.request??{};
 const evidence=c.evidence?.analysis??{};
 const consensus=c.evidence?.consensus??{};
 const packageSearch=c.retrieval?.packageSearch??{};
 const intent=c.planning?.intentPlan??{};
 const teachers=Number(c.external?.teacherCount??0);
 const searchAvailable=Boolean(c.external?.searchAvailable);
 const plannerAvailable=c.external?.plannerAvailable!==false;
 const complex=Boolean(c.planning?.taskGraph?.nodes?.length>1||c.task?.complex===true||intent.sequence?.length>2);
 const answerability=c.understanding?.answerability??null;

 // R3 safety is absolute precedence. It must run before Answerability,
 // retrieval, Teacher, Planner, or any other capability recommendation.
 if(safety.level==='R3')return pick(c,'HUMAN','safety_requires_protective_handoff',{action:'protect_and_refer',specialistCategory:c.safety?.escalation?.category??null},[
  reject('SEARCH','safety_precedence'),reject('TEACHER','safety_precedence'),reject('PLAN','safety_precedence')]);

 const verification=c.verification?.verdict??null;
 if(verification&&!verification.accepted){
   if(verification.status==='SAFETY_BLOCK')return pick(c,'HUMAN','verification_safety_block',{action:'protective_handoff'});
   if(verification.status==='CONFLICT')return pick(c,'STOP','verification_conflict_must_be_reported',{action:'report_source_disagreement',verification});
   if(verification.status==='NEED_MORE_EVIDENCE'&&searchAvailable)return pick(c,'SEARCH','verification_requests_better_evidence',{action:'retrieve_better_sources_then_reenter'});
   return pick(c,'STOP','verification_rejected_result',{action:'state_verification_boundary',verification});
 }

 // Answerability is an assessment for the current evidence snapshot, not a
 // permanent route command. After SEARCH/TEACHER/PLAN verification, that
 // assessment is stale and must not re-trigger the same external route.
 const answerabilityActive=!verification&&!/^POST_VERIFY_/.test(String(c.phase??''));
 if(answerabilityActive&&answerability?.decision==='HUMAN')return pick(c,'HUMAN','answerability_requires_human',{action:'protective_or_professional_handoff',answerability});
 if(answerabilityActive&&answerability?.decision==='STOP')return pick(c,'STOP','answerability_boundary',{action:'state_current_limit',answerability});
 if(answerabilityActive&&answerability?.decision==='CLARIFY')return pick(c,'CLARIFY','answerability_requests_decisive_evidence',{action:'ask_for_targeted_evidence',request:request?.request??resolution.nextEvidence?.[0]??{instruction:'请补充一条能确认目标或关键事实的信息。'},answerability});
 if(answerabilityActive&&answerability?.decision==='SEARCH'&&searchAvailable)return pick(c,'SEARCH','answerability_requires_retrieval',{action:'retrieve_then_reenter_orchestrator',queries:retrieval.queries??[],needsFreshness:Boolean(answerability.freshnessRequired),answerability});
 if(answerabilityActive&&answerability?.decision==='TEACHER'&&teachers>0)return pick(c,'TEACHER','answerability_requires_specialist',{action:'send_minimum_necessary_task_package_then_reenter',answerability});

 // Accepted external work is still re-entered; only the Orchestrator may decide it is ready to present.
 if(verification?.accepted&&verification.route==='TEACHER')
   return pick(c,'LOCAL',verification.status==='ACCEPT_WITH_CAVEAT'?'verified_teacher_candidate_ready_with_caveat':'verified_teacher_result_ready',{action:'present_verified_teacher_result',verification});
 if(verification?.accepted&&verification.route==='PLAN'){
   const plannerState=c.planning?.plannerState;
   if(plannerState?.question)return pick(c,'CLARIFY','verified_plan_requests_user_input',{action:'ask_planner_question',request:{instruction:plannerState.question}});
   return pick(c,'LOCAL','verified_plan_result_ready',{action:'present_verified_plan_result',verification});
 }

 if(shouldClarify({resolution,evidence,request,retrieval}))return pick(c,'CLARIFY','useful_user_evidence_can_resolve_uncertainty',{action:'ask_for_targeted_evidence',request:request.request??resolution.nextEvidence?.[0]??null},[
  reject('SEARCH','collect_cheaper_decisive_evidence_first'),reject('TEACHER','collect_cheaper_decisive_evidence_first')]);

 // Re-entry: completed retrieval is evidence, not a terminal answer by itself.
 if(packageSearch.status==='completed'){
   if(['accept_consensus','use_resolved_preference_with_caveat','use_consensus'].includes(consensus.recommendation)||consensus.status==='consistent'){
     if(teachers>0&&needsSynthesis(c))return pick(c,'TEACHER','retrieval_verified_specialist_synthesis_needed',{action:'send_verified_evidence_only'},[reject('SEARCH','retrieval_already_sufficient')]);
     return pick(c,'LOCAL','retrieval_verified_local_synthesis_allowed',{action:'synthesize_verified_retrieval_with_attribution'},[reject('SEARCH','retrieval_already_sufficient')]);
   }
   if(consensus.recommendation==='search_more_or_report_disagreement'&&c.evidence?.retrieval?.action==='report')
     return pick(c,'STOP','retrieval_conflict_must_be_reported',{action:'report_source_disagreement'});
 }

 if(retrieval.localCanAnswer||resolution.decision==='local_explain')return pick(c,'LOCAL','local_evidence_sufficient',{action:'explain_with_evidence_boundary'},[
   reject('SEARCH','unnecessary_cost_and_latency'),reject('TEACHER','unnecessary_external_escalation')]);

 if(retrieval.shouldSearch&&searchAvailable&&packageSearch.status!=='completed')return pick(c,'SEARCH','retrieval_is_best_next_capability',{action:'retrieve_then_reenter_orchestrator',queries:retrieval.queries??[],preferredSources:retrieval.preferredSources??[],requireCrossCheck:Boolean(retrieval.requireCrossCheck),needsFreshness:Boolean(retrieval.needsFreshness),needsAuthority:Boolean(retrieval.needsAuthority),needsImageSearch:Boolean(retrieval.needsImageSearch),retrievalPlan:retrieval},[
   reject('TEACHER','public_evidence_should_be_checked_first')]);

 if(complex&&plannerAvailable&&(teachers>0||searchAvailable))return pick(c,'PLAN','multi_step_task_requires_bounded_plan',{action:'execute_task_graph_then_reenter'},[]);

 if(safety.level==='R2'&&safety.requiresExpert)return teachers>0
   ?pick(c,'TEACHER','risk_requires_specialist_review',{action:'specialist_review_then_reenter'})
   :pick(c,'HUMAN','risk_requires_specialist_but_no_teacher_available',{action:'refer_to_qualified_professional'});

 if(teachers>0&&(resolution.escalation?.needed||intent.shouldRouteExternally||retrieval.shouldSearch))
   return pick(c,'TEACHER',retrieval.shouldSearch&&!searchAvailable?'search_unavailable_teacher_may_help_nonfresh_subproblem':'specialist_has_clear_remaining_role',{
     action:'send_minimum_necessary_task_package_then_reenter',
     warning:retrieval.needsFreshness&&!searchAvailable?'Do not answer freshness-sensitive claims from memory.':null,
   });

 if(retrieval.shouldSearch&&!searchAvailable)return pick(c,'STOP','retrieval_required_but_unavailable',{action:'explain_limits_and_offer_manual_search_or_specialist'});
 if(resolution.escalation?.needed)return pick(c,'STOP','unresolved_and_no_external_capability_available',{action:'state_uncertainty_and_best_next_help_path'});
 return pick(c,'LOCAL','bounded_local_fallback',{action:'explain_known_facts_without_bluffing'});
}


export function authorizeUserRouteRequest({route,context,reason='user_explicit_route_request',details={}}={}){
 if(!['TEACHER','SEARCH','PLAN'].includes(route))throw new Error(`USER_ROUTE_NOT_ALLOWED:${route}`);
 return createRouteContract({route,reason,details,context,alternatives:[]});
}

export function routePresentation(orchestration={}){
 const map={LOCAL:{label:'本地解说',kind:'local',showTeacher:false},CLARIFY:{label:'需要补充信息',kind:'clarify',showTeacher:false},SEARCH:{label:'需要查证',kind:'search',showTeacher:false},PLAN:{label:'分步处理',kind:'plan',showTeacher:true},TEACHER:{label:'需要专业协助',kind:'teacher',showTeacher:true},HUMAN:{label:'建议专业人员',kind:'human',showTeacher:false},STOP:{label:'证据不足',kind:'stop',showTeacher:false}};
 return map[orchestration.route]??map.STOP;
}
function shouldClarify({resolution,evidence,request,retrieval}){if(resolution.decision!=='need_more_evidence')return false;if(request?.request)return true;if((resolution.nextEvidence??[]).length)return true;return Boolean(evidence?.gaps?.length&&!retrieval.needsFreshness)}
function needsSynthesis(c){return Boolean(c.planning?.intentPlan?.sequence?.some(x=>['compare','evaluate','diagnose','solve','learn'].includes(x)))}
function reject(route,rejectedBecause){return {route,rejectedBecause}}
function pick(context,route,reason,details={},alternatives=[]){return createRouteContract({route,reason,details,context,alternatives})}

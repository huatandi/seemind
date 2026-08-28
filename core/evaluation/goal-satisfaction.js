/**
 * Goal closure is deliberately separate from graph completion.
 * A workflow may finish every node while the user's requested outcome remains
 * unsupported, stale, partial, or explicitly unresolved.
 */
export function assessGoalSatisfaction({graph,context={},result=null}={}){
  const task=graph?.task??context.taskPackage?.task??{};
  const required=[...new Set(task.requiredCapabilities??[])];
  const completed=(graph?.nodes??[]).filter(n=>n.state==='completed');
  const failed=(graph?.nodes??[]).filter(n=>n.state==='failed'&&!n.optional);
  const blocked=(graph?.nodes??[]).filter(n=>n.state==='blocked');
  const warnings=[...(context.warnings??[])];
  const evidence=[...(context.evidence??[]),...completed.flatMap(n=>n.evidence??[])];
  const finalNode=[...completed].reverse().find(n=>/^final/.test(n.id)||/final_|recommendation|answer/.test(n.type));
  const finalValue=result??context.result??finalNode?.output??null;
  const unresolvedEvidence=warnings.some(w=>/UNRESOLVED|CONFLICT|INSUFFICIENT|MISSING/i.test(String(w)));
  const freshnessNeeded=required.includes('retrieve_current_info')||(graph?.nodes??[]).some(n=>n.metadata?.freshness);
  const freshEvidence=freshnessNeeded?hasFreshEvidence(evidence,completed):true;
  const requestedCompare=required.includes('compare')||/compare|comparison|比较|对比/.test(`${task.type??''} ${task.userIntent??''}`.toLowerCase());
  const compareDone=!requestedCompare||completed.some(n=>n.type==='compare_options'||n.id==='compare');
  const requestedSearch=required.includes('search')||required.includes('retrieve_current_info');
  const searchDone=!requestedSearch||completed.some(n=>/retrieve|search/.test(`${n.type} ${n.id}`));
  const requestedIdentify=required.includes('identify');
  const identityDone=!requestedIdentify||Boolean(context.verifiedEntity)||completed.some(n=>n.type==='identify_entity'&&hasMeaningfulOutput(n.output));
  const finalPresent=hasMeaningfulOutput(finalValue);

  const gaps=[];
  if(failed.length)gaps.push('required_node_failed');
  if(blocked.length)gaps.push('workflow_blocked');
  if(!identityDone)gaps.push('identity_not_resolved');
  if(!searchDone)gaps.push('requested_retrieval_not_completed');
  if(!compareDone)gaps.push('requested_comparison_not_completed');
  if(!freshEvidence)gaps.push('freshness_evidence_missing');
  if(unresolvedEvidence)gaps.push('unresolved_evidence_or_conflict');
  if(!finalPresent)gaps.push('usable_final_result_missing');

  let status='satisfied',reason='GOAL_SUPPORTED_BY_COMPLETED_WORK';
  if(blocked.length){status='blocked';reason='USER_OR_EVIDENCE_INPUT_REQUIRED'}
  else if(failed.length||!finalPresent){status='unsatisfied';reason='EXECUTION_DID_NOT_PRODUCE_USABLE_OUTCOME'}
  else if(gaps.length){status='partial';reason='WORKFLOW_COMPLETED_BUT_GOAL_NOT_FULLY_SUPPORTED'}

  return {
    schemaVersion:1,status,reason,graphCompleted:graph?.state==='completed',
    goal:task.userIntent??task.type??null,requiredCapabilities:required,
    checks:{finalPresent,identityDone,searchDone,compareDone,freshEvidence,noBlockingEvidenceConflict:!unresolvedEvidence},
    gaps,nextAction:nextAction(status,gaps),
    boundary:'graph_completion_is_not_goal_completion',
  };
}

function hasMeaningfulOutput(v){
  if(v==null)return false;
  if(typeof v==='string')return Boolean(v.trim());
  if(Array.isArray(v))return v.length>0;
  if(typeof v==='object')return Object.keys(v).length>0;
  return true;
}
function hasFreshEvidence(evidence,nodes){
  if(nodes.some(n=>n.metadata?.freshness&&n.state==='completed'&&hasMeaningfulOutput(n.output)))return true;
  return evidence.some(e=>Boolean(e?.accessedAt||e?.retrievedAt||e?.freshness?.checkedAt||e?.timestamp));
}
function nextAction(status,gaps){
  if(status==='satisfied')return 'present_result';
  if(status==='blocked')return 'collect_requested_user_evidence';
  if(gaps.includes('freshness_evidence_missing')||gaps.includes('requested_retrieval_not_completed'))return 'retrieve_or_refresh_evidence';
  if(gaps.includes('identity_not_resolved'))return 'resolve_identity_before_identity_dependent_claims';
  if(gaps.includes('unresolved_evidence_or_conflict'))return 'resolve_conflict_or_report_bounded_uncertainty';
  return 'replan_or_state_current_limit';
}

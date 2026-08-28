export function replayAudit(events=[]){
  const ordered=[...events].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  const replay={schemaVersion:1,executionId:ordered.find(e=>e.executionId)?.executionId??null,taskId:ordered.find(e=>e.taskId)?.taskId??null,startedAt:ordered[0]?.at??null,endedAt:ordered.at(-1)?.at??null,status:'unknown',steps:[],teacherSelections:[],searches:[],warnings:[],failures:[],finalDecision:null};
  for(const e of ordered){
    const d=e.data??{};
    if(e.type==='planner_graph_started')replay.status='running';
    if(e.type==='planner_graph_completed')replay.status='completed';
    if(e.type==='planner_graph_stopped')replay.status=d.state??'stopped';
    if(e.type==='planner_graph_blocked')replay.status='blocked';
    if(e.type.startsWith('planner_node_'))replay.steps.push({at:e.at,event:e.type,nodeId:d.nodeId??null,nodeType:d.nodeType??null,reason:d.reason??d.code??null});
    if(e.type==='teacher_attempt')replay.teacherSelections.push({at:e.at,providerId:d.providerId??null,score:d.score??null,reasons:d.reasons??[],fallback:Boolean(d.fallback)});
    if(e.type==='teacher_error'||e.type==='teacher_invalid'||e.type==='planner_node_failed')replay.failures.push({at:e.at,type:e.type,providerId:d.providerId??null,nodeId:d.nodeId??null,error:d.error??d.issues??d.code??null});
    if(e.type==='search_planned'||e.type==='search_completed'||e.type==='search_escalated')replay.searches.push({at:e.at,type:e.type,nodeType:d.nodeType??null,queryFingerprint:d.queryFingerprint??null,sourceCount:d.sourceCount??d.evidenceCount??null,action:d.action??null,reason:d.reason??null});
    if(e.type==='evidence_consensus'&&(d.status==='conflicted'||d.resolutionStatus==='resolved'))replay.warnings.push({at:e.at,type:'evidence_consensus',status:d.status,resolutionStatus:d.resolutionStatus??null,recommendation:d.recommendation??null});
    if(e.type==='result_accepted'||e.type==='result_rejected')replay.finalDecision={at:e.at,type:e.type,reason:d.reason??null,providerId:d.providerId??null};
  }
  return replay;
}

export function explainAuditReplay(replay){
  const parts=[];
  if(replay.teacherSelections.length){const t=replay.teacherSelections[0];parts.push(`Teacher ${t.providerId??'unknown'} was selected${t.score!=null?` with score ${Number(t.score).toFixed(3)}`:''}.`)}
  if(replay.searches.length)parts.push(`Search ran ${replay.searches.filter(x=>x.type==='search_completed').length} time(s), with targeted escalation when needed.`);
  if(replay.failures.length)parts.push(`${replay.failures.length} failure/invalid event(s) were recorded and preserved for diagnosis.`);
  if(replay.warnings.length)parts.push(`${replay.warnings.length} evidence conflict/consensus warning(s) were retained.`);
  if(replay.finalDecision)parts.push(`Final validation: ${replay.finalDecision.type}${replay.finalDecision.reason?` (${replay.finalDecision.reason})`:''}.`);
  parts.push(`Execution status: ${replay.status}.`);return parts.join(' ');
}

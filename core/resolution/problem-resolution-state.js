/**
 * Evidence-grounded problem resolution state.
 * "Answer generated" and "specialist returned" are never equivalent to resolved.
 */
export function assessProblemResolution({goal=null,subgoals=[],verifiedEvidence=[],specialistJobs=[],userOutcome=null,nextAction=null}={}){
  const goals=normalizeGoals(goal,subgoals),evidence=verifiedEvidence.filter(x=>x?.verified!==false);
  const completed=new Set([
    ...evidence.flatMap(x=>x.resolves??[]),
    ...specialistJobs.filter(x=>x.status==='verified').flatMap(x=>x.resolves??[x.id]),
  ]);
  const goalRows=goals.map(g=>({...g,resolved:completed.has(g.id)||g.resolved===true}));
  const unresolved=goalRows.filter(x=>!x.resolved);
  let status='investigating',reason='OPEN_GOALS';
  if(userOutcome==='resolved'){status='resolved';reason='USER_CONFIRMED_RESOLVED'}
  else if(userOutcome==='not_resolved'){status='investigating';reason='USER_CONFIRMED_NOT_RESOLVED'}
  else if(goalRows.length&&unresolved.length===0){status='resolved_candidate';reason='ALL_GOALS_EVIDENCE_RESOLVED'}
  else if(nextAction){status='action_pending';reason='NEXT_ACTION_REQUIRED'}
  return {schemaVersion:1,status,reason,goals:goalRows,unresolvedGoalIds:unresolved.map(x=>x.id),
    resolutionRatio:goalRows.length?(goalRows.length-unresolved.length)/goalRows.length:0,
    externallyAnswered:specialistJobs.some(x=>['returned','verified'].includes(x.status)),
    userConfirmed:userOutcome==='resolved',nextAction:status==='resolved'?null:nextAction??null};
}
export function deriveNextResolutionAction({resolution,composition=null}={}){
  if(!resolution||['resolved','resolved_candidate'].includes(resolution.status))return null;
  const open=new Set(resolution.unresolvedGoalIds??[]);
  const jobs=(composition?.jobs??[]).filter(j=>open.has(j.id)||[...(j.resolves??[])].some(x=>open.has(x)));
  const first=jobs[0];
  return first?{kind:'specialist_job',jobId:first.id,reason:'UNRESOLVED_GOAL'}:resolution.nextAction??null;
}
export function canCloseProblem(resolution){
  return Boolean(resolution?.status==='resolved'||(resolution?.status==='resolved_candidate'&&resolution?.resolutionRatio===1));
}
function normalizeGoals(goal,subgoals){
  const rows=(subgoals??[]).map((x,i)=>typeof x==='string'?{id:`g${i+1}`,text:x}:{id:x.id??`g${i+1}`,text:x.text??x.goal??x.id,resolved:Boolean(x.resolved)});
  if(rows.length)return rows;
  return goal?[{id:'goal',text:typeof goal==='string'?goal:goal.text??goal.goal??'goal',resolved:Boolean(goal.resolved)}]:[];
}

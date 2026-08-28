/**
 * Decides whether task decomposition itself needs a high-capability planning specialist.
 * The planner advises; SeeMind validates and retains execution authority.
 */
const MAX_PLAN_JOBS=5;
export function assessPlanningNeed({task={},studentPlan=null,residuals=[],confidence=null}={}){
  const text=`${task.userIntent??''} ${task.question??''}`.trim();
  const signals=[];
  const clauses=text.split(/[，,；;。!?！？]|\b(?:and|then|also|plus)\b/i).map(x=>x.trim()).filter(Boolean);
  if(clauses.length>=3)signals.push('MULTI_INTENT');
  if((studentPlan?.jobs??[]).length>=3)signals.push('MULTI_STAGE');
  if((studentPlan?.jobs??[]).some(j=>(j.dependsOn??[]).length>=2))signals.push('DEPENDENCY_RICH');
  if((residuals??[]).length>=3)signals.push('MULTIPLE_RESIDUALS');
  if(confidence!=null&&Number(confidence)<.62)signals.push('LOW_DECOMPOSITION_CONFIDENCE');
  const score=Math.min(1,signals.length*.24+(clauses.length>=4?.18:0));
  return {schemaVersion:1,needsPlanningSpecialist:score>=.48,score,signals,
    requiredCapability:score>=.48?'complex_problem_decomposition':null,
    principle:'PLANNER_ADVISES_SEEMIND_DECIDES'};
}
export function buildPlanningSpecialistBrief({task={},student={},knownFacts=[],residuals=[]}={}){
  return {schemaVersion:1,capability:'complex_problem_decomposition',
    objective:'Decompose the user goal into the smallest useful capability-specific task graph.',
    userGoal:task.userIntent??task.question??null,knownFacts:knownFacts.slice(0,12),residuals:residuals.slice(0,8),
    constraints:{maxJobs:MAX_PLAN_JOBS,preserveKnownStudentWork:true,noProviderSelection:true,noExecutionAuthority:true,
      noSafetyOverride:true,noPrivacyOverride:true,outputsArePlanProposalOnly:true},
    requestedOutput:{goals:true,jobs:true,dependencies:true,requiredCapabilities:true,successCriteria:true}};
}
export function validatePlanningProposal(proposal,{knownCompletedIds=[],allowedCapabilities=null}={}){
  const jobs=(proposal?.jobs??[]).slice(0,MAX_PLAN_JOBS).map(normalizeJob);
  const errors=[],ids=new Set(jobs.map(x=>x.id));
  if(!jobs.length)errors.push('EMPTY_PLAN');
  if(ids.size!==jobs.length)errors.push('DUPLICATE_JOB_ID');
  for(const j of jobs){
    if(j.dependsOn.some(d=>!ids.has(d)))errors.push(`UNKNOWN_DEPENDENCY:${j.id}`);
    if(j.dependsOn.includes(j.id))errors.push(`SELF_DEPENDENCY:${j.id}`);
    if((knownCompletedIds??[]).includes(j.id))errors.push(`REDO_COMPLETED_WORK:${j.id}`);
    if(allowedCapabilities&&j.requiredCapabilities.some(c=>!allowedCapabilities.includes(c)))errors.push(`CAPABILITY_NOT_ALLOWED:${j.id}`);
  }
  if(hasCycle(jobs))errors.push('CYCLIC_PLAN');
  return {schemaVersion:1,accepted:errors.length===0,errors,jobs:errors.length?[]:jobs,
    executionAuthority:'SEEMIND',plannerAuthority:'ADVISORY_ONLY'};
}
function normalizeJob(x,i){return {id:String(x?.id??`job_${i+1}`),kind:String(x?.kind??'specialist_task'),
  requiredCapabilities:[...new Set(x?.requiredCapabilities??[])].map(String),
  dependsOn:[...new Set(x?.dependsOn??[])].map(String),successCriteria:x?.successCriteria??null,
  outputPolicy:'CANDIDATE_EVIDENCE_ONLY'}}
function hasCycle(jobs){const map=new Map(jobs.map(j=>[j.id,j.dependsOn])),vis=new Set(),stack=new Set();
 const visit=id=>{if(stack.has(id))return true;if(vis.has(id))return false;vis.add(id);stack.add(id);for(const d of map.get(id)??[])if(visit(d))return true;stack.delete(id);return false};
 return jobs.some(j=>visit(j.id))}

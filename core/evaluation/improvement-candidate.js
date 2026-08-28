const ALLOWED_STAGES=new Set(['proposed','offline_evaluated','regression_passed','approved','promoted','rejected']);

export function createImprovementCandidate({evaluation,target=null,proposal=null,createdAt=new Date().toISOString()}={}){
  if(!evaluation)throw new Error('EVALUATION_REQUIRED');
  const primary=evaluation.primaryFailure;
  if(!primary)return null;
  return {
    schemaVersion:1,
    id:randomId('candidate'),
    evaluationId:evaluation.evaluationId,
    taskId:evaluation.taskId??null,
    executionId:evaluation.executionId??null,
    category:primary.category,
    failureCode:primary.code,
    target:target??targetFor(primary.category),
    proposal:proposal??proposalFor(primary),
    evidenceEventIds:evaluation.findings.map(x=>x.eventId).filter(Boolean),
    stage:'proposed',
    createdAt,
    history:[{stage:'proposed',at:createdAt,note:'Generated from offline evaluation. No production change applied.'}],
  };
}

export function transitionCandidate(candidate,next,{note='',at=new Date().toISOString(),approval=false}={}){
  if(!candidate||!ALLOWED_STAGES.has(next))throw new Error('INVALID_CANDIDATE_STAGE');
  const current=candidate.stage;
  const allowed={proposed:['offline_evaluated','rejected'],offline_evaluated:['regression_passed','rejected'],regression_passed:['approved','rejected'],approved:['promoted','rejected'],promoted:[],rejected:[]}[current]??[];
  if(!allowed.includes(next))throw new Error(`INVALID_CANDIDATE_TRANSITION:${current}->${next}`);
  if(next==='approved'&&!approval)throw new Error('EXPLICIT_APPROVAL_REQUIRED');
  return {...candidate,stage:next,history:[...(candidate.history??[]),{stage:next,at,note:String(note).slice(0,300)}]};
}

export function canPromoteCandidate(candidate){return {ok:candidate?.stage==='approved',reason:candidate?.stage==='approved'?null:'CANDIDATE_NOT_APPROVED'}}

function targetFor(category){return ({perception_error:'perception',entity_error:'entity_resolver',router_error:'teacher_router',teacher_output_invalid:'teacher_contract',search_source_failure:'search_strategy',evidence_failure:'evidence_judge',provider_failure:'provider_health',contract_failure:'schema_contract',user_input_insufficient:'clarification',budget_failure:'budget_policy',execution_failure:'task_handler'})[category]??'unknown'}
function proposalFor(f){return ({perception_error:'Add or refine preprocessing/OCR test cases before changing production OCR.',entity_error:'Add identity counterexample and verify resolver thresholds.',router_error:'Evaluate capability/health weighting against a benchmark before changing router weights.',teacher_output_invalid:'Strengthen provider output contract or prompt adapter and replay against golden cases.',search_source_failure:'Improve evidence retrieval strategy/source targeting and replay search cases.',evidence_failure:'Add evidence/consensus cases and review judge thresholds.',provider_failure:'Review provider health/fallback behavior; do not change domain logic.',contract_failure:'Fix schema/adapter compliance and run contract regression.',user_input_insufficient:'Improve one-question clarification path; do not infer missing data.',budget_failure:'Review graph decomposition and budgets using replay data.',execution_failure:'Fix the responsible node handler and add regression coverage.'})[f.category]??'Review failure offline and add regression coverage before any production change.'}
function randomId(prefix){return globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`}

export function auditMainlineFlow({flow=null,problemState=null,observation=null,latencyBudget=null}={}){
 const issues=[],transitions=flow?.transitions??[];
 const external=transitions.filter(x=>['SEARCH','TEACHER','PLAN'].includes(x.contract?.route));
 for(let i=1;i<external.length;i++){
  const a=external[i-1],b=external[i];
  if(a.contract?.route===b.contract?.route&&a.contract?.reason===b.contract?.reason)
   issues.push({severity:'high',code:'DUPLICATE_EXTERNAL_ROUTE',route:b.contract.route,reason:b.contract.reason});
 }
 if(flow?.status==='max_transitions')issues.push({severity:'high',code:'MAX_TRANSITIONS_REACHED'});
 if(flow?.status==='route_budget_exhausted')issues.push({severity:'high',code:'EXTERNAL_ROUTE_BUDGET_EXHAUSTED',reason:flow?.reason??null});
 const verified=flow?.context?.verification?.verdict??null;
 const externalCandidate=flow?.context?.external?.teacherState?.answer??flow?.context?.planning?.plannerState?.resultValue??null;
 if(externalCandidate&&!verified?.accepted)issues.push({severity:'high',code:'UNVERIFIED_EXTERNAL_RESULT_PRESENT'});
 const runtime=(observation?.observations??[]).find(x=>x.kind==='runtime_latency')??null;
 if(runtime&&runtime.localWithinBudget===false)issues.push({severity:'medium',code:'LOCAL_LATENCY_BUDGET_EXCEEDED',totalMs:runtime.totalMs,budgetTier:runtime.budgetTier});
 if(runtime&&runtime.firstUsefulWithinBudget===false)issues.push({severity:'medium',code:'FIRST_USEFUL_FEEDBACK_LATE',firstUsefulMs:runtime.firstUsefulMs,budgetTier:runtime.budgetTier});
 const routes=problemState?.routeHistory??[];
 const tail=routes.slice(-3).map(x=>x.route);
 if(tail.length===3&&tail.every(x=>x===tail[0]))issues.push({severity:'medium',code:'PROBLEM_ROUTE_STAGNATION',route:tail[0]});
 return {
  schemaVersion:1,
  healthy:!issues.some(x=>x.severity==='high'),
  issues,
  metrics:{
   transitions:transitions.length,
   externalCalls:external.length,
   localLatencyMs:runtime?.totalMs??null,
   firstUsefulMs:runtime?.firstUsefulMs??null,
  },
 };
}

export function shouldAllowAnotherExternalCall({flow=null,route,maxSameRoute=2}={}){
 const transitions=flow?.transitions??[];
 const same=transitions.filter(x=>x.contract?.route===route);
 if(same.length<maxSameRoute)return {allowed:true,reason:'WITHIN_EXTERNAL_CALL_BUDGET',used:same.length,max:maxSameRoute};
 const lastVerification=flow?.context?.verification?.verdict??null;
 if(lastVerification?.status==='NEED_MORE_EVIDENCE'&&route==='SEARCH')
  return {allowed:true,reason:'VERIFIER_EXPLICITLY_REQUESTED_MORE_EVIDENCE',used:same.length,max:maxSameRoute};
 return {allowed:false,reason:'EXTERNAL_ROUTE_REPEAT_BUDGET_EXCEEDED',used:same.length,max:maxSameRoute};
}

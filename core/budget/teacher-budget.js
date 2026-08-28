export function createTeacherBudget(input={}){
  return {
    maxTeacherCalls: positiveInt(input.maxTeacherCalls, 2),
    maxSearches: positiveInt(input.maxSearches, 3),
    maxFallbacks: positiveInt(input.maxFallbacks, 1),
    maxLatencyMs: positiveInt(input.maxLatencyMs, 30000),
    maxCloudCost: finiteOrNull(input.maxCloudCost),
  };
}
export function createBudgetState(budget=createTeacherBudget()){
  return {budget,calls:0,fallbacks:0,startedAt:Date.now(),spent:0};
}
export function canCallTeacher(state){
  if(state.calls>=state.budget.maxTeacherCalls) return {ok:false,reason:'teacher_call_budget_exceeded'};
  if(Date.now()-state.startedAt>state.budget.maxLatencyMs) return {ok:false,reason:'latency_budget_exceeded'};
  if(state.budget.maxCloudCost!=null && state.spent>=state.budget.maxCloudCost) return {ok:false,reason:'cost_budget_exceeded'};
  return {ok:true};
}
function positiveInt(v,f){const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=0?n:f}
function finiteOrNull(v){const n=Number(v);return v==null||!Number.isFinite(n)?null:Math.max(0,n)}

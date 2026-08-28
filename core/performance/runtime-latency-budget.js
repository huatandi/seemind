export function createRuntimeLatencyBudget(deviceProfile={}){
  const tier=deviceProfile.tier??'balanced';
  if(tier==='low_power')return budget('low_power',900,1800,2800,1,1);
  if(tier==='performance')return budget('performance',650,1800,4500,2,2);
  return budget('balanced',800,1800,3400,1,1);
}
export function evaluateRuntimeLatency({startedAt,firstUsefulAt=null,completedAt=Date.now(),budget}={}){
  const totalMs=Math.max(0,completedAt-startedAt);
  const firstUsefulMs=firstUsefulAt==null?null:Math.max(0,firstUsefulAt-startedAt);
  return {schemaVersion:1,totalMs,firstUsefulMs,
    firstUsefulWithinBudget:firstUsefulMs==null?null:firstUsefulMs<=budget.firstUsefulMs,
    localWithinBudget:totalMs<=budget.maxLocalDecisionMs,
    shouldDeferHeavyLocalWork:totalMs>=budget.deferHeavyAfterMs,
    budgetTier:budget.tier};
}
export function shouldRunHeavyLocalStage({elapsedMs=0,budget={},deviceProfile={},estimatedMs=null}={}){
  if(deviceProfile.connection?.saveData&&budget.heavyModels<=0)return {allowed:false,reason:'DEVICE_POLICY'};
  if(elapsedMs>=Number(budget.deferHeavyAfterMs??1800))return {allowed:false,reason:'FAST_PATH_DEADLINE'};
  if(Number.isFinite(estimatedMs)&&elapsedMs+estimatedMs>Number(budget.maxLocalDecisionMs??3400))return {allowed:false,reason:'PREDICTED_BUDGET_OVERRUN'};
  return {allowed:true,reason:'WITHIN_BUDGET'};
}
function budget(tier,firstUsefulMs,deferHeavyAfterMs,maxLocalDecisionMs,heavyModels,maxConcurrentHeavyModels){return {schemaVersion:1,tier,firstUsefulMs,deferHeavyAfterMs,maxLocalDecisionMs,heavyModels,maxConcurrentHeavyModels}}

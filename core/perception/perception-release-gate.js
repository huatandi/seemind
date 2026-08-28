export function evaluatePerceptionRelease({metrics={},targets={}}={}){
 const t={
  minSuccessRate:targets.minSuccessRate??.97,
  minQuality:targets.minQuality??.85,
  maxP50LatencyMs:targets.maxP50LatencyMs??1500,
  maxP95LatencyMs:targets.maxP95LatencyMs??4000,
 };
 const checks=[
  check('success_rate',metrics.successRate,t.minSuccessRate,'min'),
  check('quality',metrics.avgQuality,t.minQuality,'min'),
  check('p50_latency',metrics.p50LatencyMs,t.maxP50LatencyMs,'max'),
  check('p95_latency',metrics.p95LatencyMs,t.maxP95LatencyMs,'max'),
 ];
 return {schemaVersion:1,passed:checks.every(x=>x.passed),checks,targets:t,principle:'A model is not promoted merely because it is smarter; latency, reliability and quality must pass together.'};
}
function check(id,value,target,mode){
 const known=Number.isFinite(Number(value));
 return {id,value:value??null,target,known,passed:known&&(mode==='min'?Number(value)>=target:Number(value)<=target)};
}

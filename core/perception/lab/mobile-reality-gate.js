export function evaluateMobileReality({session,deviceProfile=session?.deviceProfile??{},thresholds={}}={}){
 const s=session?.summary??{};
 const tier=deviceProfile.tier??'balanced';
 const limits={
  minSuccess:thresholds.minSuccess??(tier==='low_power'?.88:.92),
  minQuality:thresholds.minQuality??.78,
  maxP95Ms:thresholds.maxP95Ms??(tier==='low_power'?4200:tier==='performance'?3500:4000),
  maxFirstUsefulMs:thresholds.maxFirstUsefulMs??(tier==='low_power'?1800:1400),
  maxBudgetExceededRate:thresholds.maxBudgetExceededRate??.10,
  maxMemoryMb:thresholds.maxMemoryMb??Number(deviceProfile.budgets?.maxVisualMemoryMb??Infinity),
 };
 const failures=[];
 if(Number(s.successRate??0)<limits.minSuccess)failures.push('SUCCESS_RATE');
 if(Number(s.avgQuality??0)<limits.minQuality)failures.push('QUALITY');
 if(Number.isFinite(s.p95LatencyMs)&&s.p95LatencyMs>limits.maxP95Ms)failures.push('P95_LATENCY');
 if(Number.isFinite(s.p95FirstUsefulMs)&&s.p95FirstUsefulMs>limits.maxFirstUsefulMs)failures.push('FIRST_USEFUL_LATENCY');
 if(Number(s.budgetExceededRate??0)>limits.maxBudgetExceededRate)failures.push('BUDGET_OVERRUN_RATE');
 if(Number.isFinite(s.p95MemoryDeltaMb)&&s.p95MemoryDeltaMb>limits.maxMemoryMb)failures.push('MEMORY_PRESSURE');
 const critical=failures.includes('SUCCESS_RATE')||failures.includes('QUALITY')||failures.includes('MEMORY_PRESSURE');
 return {
  schemaVersion:1,tier,passed:failures.length===0,failures,limits,
  recommendation:failures.length===0?'PROMOTE_LOCAL':critical?'PREFER_LIGHTER_LOCAL_OR_TEACHER':'KEEP_LOCAL_WITH_DEFERRED_HEAVY_STAGE',
  principle:'Benchmark evidence may tune routing/promotion; it must not silently promote a model on one device sample.',
 };
}

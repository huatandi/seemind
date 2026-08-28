export function scoreBenchmark(benchmark={},profile={}){
  const runs=Number(benchmark.runs??0),successes=Number(benchmark.successes??0),timeouts=Number(benchmark.timeouts??0);
  const successRate=runs?successes/runs:null;
  const avgInferenceMs=Number(benchmark.avgInferenceMs??NaN);
  const limit=Number(profile?.budgets?.maxInferenceMs??6000);
  let score=.5,recommendation='unknown';
  if(successRate!=null)score=successRate*.65;
  if(Number.isFinite(avgInferenceMs)){
    const latencyFit = avgInferenceMs <= limit * .35
      ? 1
      : avgInferenceMs <= limit * .7
        ? .82
        : avgInferenceMs <= limit
          ? .6
          : .25;
    score+=latencyFit*.35;
  }else score+=.2;
  if(timeouts>=2)score-=.25;
  score=Math.max(0,Math.min(1,score));
  if(runs<2)recommendation='needs_benchmark';
  else if(score>=.78)recommendation='preferred';
  else if(score>=.55)recommendation='allowed';
  else recommendation='avoid';
  return {score,recommendation,successRate,avgInferenceMs:Number.isFinite(avgInferenceMs)?avgInferenceMs:null};
}

export function tuneVisualPolicy({profile,benchmarks=[],providers=[]}={}){
  const byProvider=new Map();
  for(const p of providers){
    const related=benchmarks.filter(x=>x.providerId===p.id);
    const scored=related.map(b=>scoreBenchmark(b,profile));
    const aggregate=scored.length?scored.reduce((s,x)=>s+x.score,0)/scored.length:null;
    const recommendation=scored.some(x=>x.recommendation==='avoid')&&aggregate<.55?'avoid':aggregate!=null&&aggregate>=.78?'preferred':aggregate!=null?'allowed':'needs_benchmark';
    byProvider.set(p.id,{score:aggregate,recommendation});
  }
  const heavyAllowed=profile?.tier!=='low_power';
  return {
    schemaVersion:1,
    deviceTier:profile?.tier??'balanced',
    heavyAllowed,
    providerPolicy:Object.fromEntries(byProvider),
    teacherBias:profile?.tier==='low_power'?'prefer_teacher_for_heavy_visual':'local_first',
    timeoutMs:Number(profile?.budgets?.maxInferenceMs??6000),
    memoryBudgetMb:Number(profile?.budgets?.maxVisualMemoryMb??384),
  };
}

export function shouldUseProvider(provider,{policy,capability}={}){
  const p=policy?.providerPolicy?.[provider.id];
  const heavy=Number(provider.estimatedMemoryMb??provider.getProfile?.().estimatedMemoryMb??0)>200;
  if(heavy&&!policy?.heavyAllowed)return {use:false,reason:'DEVICE_TIER_BLOCKS_HEAVY_MODEL'};
  if(p?.recommendation==='avoid')return {use:false,reason:'BENCHMARK_AVOID'};
  return {use:true,reason:p?.recommendation??'NO_BENCHMARK'};
}

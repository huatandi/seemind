export function createPerceptionBudget(deviceProfile={},triage={}){
  const tier=deviceProfile.tier??'balanced';
  const mobileMemoryUncertain=Boolean(deviceProfile.platform?.mobileUnknownMemory);

  const base=tier==='low_power'
    ?{firstUsefulMs:1200,totalLocalMs:2600,ocrCandidates:1,ocrEngines:1,heavyModels:1}
    :tier==='performance'
      ?{firstUsefulMs:900,totalLocalMs:4200,ocrCandidates:2,ocrEngines:2,heavyModels:2}
      :{firstUsefulMs:1000,totalLocalMs:3200,ocrCandidates:1,ocrEngines:1,heavyModels:1};
  const bounded={...base,
    totalLocalMs:Math.min(base.totalLocalMs,Number(deviceProfile.budgets?.maxInferenceMs??base.totalLocalMs)),
    heavyModels:mobileMemoryUncertain?Math.min(base.heavyModels,1):base.heavyModels,
    maxVisualMemoryMb:Number(deviceProfile.budgets?.maxVisualMemoryMb??null)||null,
    deviceUncertainty:mobileMemoryUncertain?'MOBILE_MEMORY_UNKNOWN':null,
  };
  if(triage.primaryRoute==='document')return {...bounded,ocrCandidates:Math.max(1,bounded.ocrCandidates),ocrPriority:'high',visionPriority:'support',recoveryCandidates:Math.max(2,bounded.ocrCandidates)};
  if(triage.primaryRoute==='universal_vision')return {...bounded,ocrCandidates:0,ocrEngines:0,ocrPriority:'deferred',visionPriority:'high'};
  return {...bounded,ocrPriority:'conditional',visionPriority:'high'};
}

export function perceptionDeadlineExceeded(started,budget,now=Date.now()){
  return now-started>Number(budget?.totalLocalMs??3200);
}

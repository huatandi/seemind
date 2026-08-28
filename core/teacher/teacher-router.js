const WEIGHTS={taskFit:.25,capabilityFit:.20,evidenceFit:.15,freshnessFit:.10,reliability:.10,historicalSuccess:.10,languageFit:.05,latencyFit:.05};

export async function rankTeachers(taskPackage,providers=[],context={}){
  const required=taskPackage?.task?.requiredCapabilities??[];
  const language=taskPackage?.task?.language??'auto';
  const scored=[];
  for(const provider of providers){
    const profile=effectiveProfile(provider);
    if(context.enabledProviderIds && !context.enabledProviderIds.has(provider.id)) continue;
    if(!required.every(c=>profile.capabilities.some(x=>x.capability===c))) continue;
    if(!privacyCompatible(taskPackage,profile,context)) continue;
    let health={status:'unknown'}; try{health=await provider.healthCheck()}catch{}
    if(!['ok','ready'].includes(health?.status)) continue;
    const components=scoreComponents({taskPackage,profile,required,language,provider,context});
    const score=Object.entries(WEIGHTS).reduce((s,[k,w])=>s+components[k]*w,0)+(Number(profile.priority??provider.priority??0)*0.001);
    scored.push({provider,profile,health,score,components,reasons:explain(components)});
  }
  return scored.sort((a,b)=>b.score-a.score);
}

export async function selectTeacher(taskPackage,providers=[],context={}){
  return (await rankTeachers(taskPackage,providers,context))[0]?.provider??null;
}

function scoreComponents({taskPackage,profile,required,language,provider,context}){
  const caps=profile.capabilities;
  const requiredScores=required.map(c=>caps.find(x=>x.capability===c)?.score??0);
  const capabilityFit=requiredScores.length?avg(requiredScores):1;
  const taskFit=capabilityFit;
  const evidenceNeeded=(taskPackage?.constraints??[]).some(x=>/evidence|cite|source/i.test(String(x)));
  const evidenceFit=evidenceNeeded?profile.evidenceScore:Math.max(.5,profile.evidenceScore);
  const freshnessNeeded=Boolean(taskPackage?.freshness?.required || taskPackage?.task?.realtimeRequired || taskPackage?.task?.webSearchRequired);
  const freshnessFit=freshnessNeeded?profile.freshnessScore:Math.max(.6,profile.freshnessScore);
  const languageFit=language==='auto'||profile.supportedLanguages.includes('auto')||profile.supportedLanguages.includes(language)?1:.4;
  const latencyFit=profile.latencyClass==='fast'?1:profile.latencyClass==='medium'?.7:.4;
  const taskType=taskPackage?.task?.type??'*';
  const learned=context?.outcomeStore?.get?.(provider?.id,taskType,required)
    ??context?.outcomeStore?.get?.(provider?.id,required)
    ??context?.performanceStore?.get?.(provider?.id,taskType);
  const historicalSuccess=learned?.attempts>0?learned.historicalSuccess:profile.historicalSuccess;
  const learnedLatency=learned?.avgLatencyMs;
  const learnedLatencyFit=learnedLatency==null?latencyFit:latencyScore(learnedLatency);
  return {taskFit,capabilityFit,evidenceFit,freshnessFit,reliability:profile.reliabilityScore,historicalSuccess,languageFit,latencyFit:learnedLatencyFit};
}
function privacyCompatible(pkg,p,ctx){
  if(ctx.localOnly && !p.privacyModes.includes('local')) return false;
  if(pkg?.safety?.sensitiveData && ctx.consent === false && !p.privacyModes.includes('local')) return false;
  return true;
}
function explain(c){return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${Math.round(v*100)}`)}
function effectiveProfile(p){
  const declared=p.getProfile?.();
  const legacyCaps=(p.getCapabilities?.()??[]).map(capability=>({capability,score:1,confidence:1}));
  if(!declared) return legacyProfile(p);
  const base=legacyProfile(p);
  return {...base,...declared,
    capabilities:declared.capabilities?.length?declared.capabilities:legacyCaps,
    supportedLanguages:declared.supportedLanguages?.length?declared.supportedLanguages:base.supportedLanguages,
    privacyModes:declared.privacyModes?.length?declared.privacyModes:base.privacyModes,
    priority:Number(p.priority??declared.priority??0)};
}
function legacyProfile(p){return {capabilities:(p.getCapabilities?.()??[]).map(capability=>({capability,score:1})),supportedLanguages:['auto'],privacyModes:['cloud'],latencyClass:'medium',reliabilityScore:.5,freshnessScore:.5,evidenceScore:.5,historicalSuccess:.5,priority:p.priority??0}}
function avg(a){return a.reduce((s,x)=>s+x,0)/a.length}

function latencyScore(ms){const n=Number(ms);if(!Number.isFinite(n))return .5;if(n<=1500)return 1;if(n<=4000)return .8;if(n<=8000)return .6;if(n<=15000)return .4;return .2;}

import {composeEvidenceWeight} from '../../perception/evidence-weight-budget.js';
import {outcomeValidationAdjustment} from '../../perception/outcome-feedback.js';
import {scenarioEvidenceAdjustment} from '../../perception/scenario-evidence-policy.js';
import {runtimeEvidenceAdjustment} from '../../perception/runtime-evidence-policy.js';
export async function rankVisualProviders({providers=[],requiredCapabilities=[],deviceClass='balanced',deviceBudget={},performanceStore=null,localOnly=true,autotunePolicy=null,runtimeEvidence=null,scenarioEvidence=null,outcomeValidation=null}={}){
  const ranked=[];
  for(const provider of providers){
    const p=provider.getProfile?.()??{};
    if(localOnly&&!(p.privacyModes??[]).includes('local'))continue;
    if(p.deviceClasses?.length&&!p.deviceClasses.includes(deviceClass))continue;
    const tuned=autotunePolicy?.providerPolicy?.[provider.id];
    if(tuned?.recommendation==='avoid')continue;
    const heavy=Number(p.estimatedMemoryMb??0)>200;
    if(heavy&&autotunePolicy?.heavyAllowed===false)continue;
    if(Number(p.estimatedMemoryMb??0)>Number(deviceBudget.maxMemoryMb??Infinity))continue;
    const capScores=requiredCapabilities.map(c=>(p.capabilities??[]).find(x=>x.capability===c)?.score??0);
    if(capScores.some(x=>x<=0))continue;
    let health={status:'unknown'};try{health=await provider.healthCheck()}catch{}
    if(!['ok','ready'].includes(health?.status))continue;
    const perf=performanceStore?.get?.(provider.id);
    const capabilityFit=capScores.length?avg(capScores):1;
    const reliability=perf?.attempts?perf.successes/perf.attempts:Number(p.reliability??.5);
    const latency=perf?.avgLatencyMs??Number(p.estimatedLatencyMs??5000);
    const latencyFit=latencyScore(latency);
    const memoryFit=memoryScore(Number(p.estimatedMemoryMb??0),Number(deviceBudget.maxMemoryMb??Infinity));
    const tuneBonus=tuned?.recommendation==='preferred' ? .08 : tuned?.recommendation==='allowed' ? .02 : 0;
    const lab=runtimeEvidenceAdjustment({engineId:provider.id,policy:runtimeEvidence});
    const scenario=scenarioEvidenceAdjustment({engineId:provider.id,scenarioEvidence});
    const outcome=outcomeValidationAdjustment({engineId:provider.id,validation:outcomeValidation});
    const evidenceBudget=composeEvidenceWeight({modality:'vision',autotune:tuneBonus,lab:lab.delta,scenario:scenario.delta,outcome:outcome.delta});
    const score=capabilityFit*.43+reliability*.24+latencyFit*.14+memoryFit*.09+Math.min(1,(Number(p.priority??0)/100))*.05+evidenceBudget.delta;
    ranked.push({provider,profile:p,score,components:{capabilityFit,reliability,latencyFit,memoryFit,tuneBonus,labEvidence:lab,scenarioEvidence:scenario,outcomeValidation:outcome,evidenceBudget},health,autotune:tuned??null});
  }
  return ranked.sort((a,b)=>b.score-a.score||String(a.provider.id).localeCompare(String(b.provider.id)));
}
export async function selectVisualProvider(args={}){return (await rankVisualProviders(args))[0]?.provider??null}
function avg(a){return a.reduce((s,x)=>s+x,0)/a.length}
function latencyScore(ms){if(ms<=800)return 1;if(ms<=2000)return .85;if(ms<=5000)return .65;if(ms<=10000)return .45;return .25}
function memoryScore(m,max){if(!Number.isFinite(max)||max<=0)return .7;const r=m/max;if(r<=.25)return 1;if(r<=.5)return .85;if(r<=.75)return .65;if(r<=1)return .4;return 0}

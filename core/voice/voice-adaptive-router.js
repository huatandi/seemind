import {composeEvidenceWeight} from '../perception/evidence-weight-budget.js';
import {outcomeValidationAdjustment} from '../perception/outcome-feedback.js';
import {scenarioEvidenceAdjustment} from '../perception/scenario-evidence-policy.js';
import {runtimeEvidenceAdjustment} from '../perception/runtime-evidence-policy.js';
export function routeVoiceEngines({engines=[],language='auto',deviceProfile={},performanceStore=null,preferStreaming=true,runtimeEvidence=null,scenarioEvidence=null,outcomeValidation=null}={}){
  const ranked=engines.map(engine=>{
    const p=engine.profile??{};
    const perf=performanceStore?.get?.(engine.id)??{};
    const languageFit=voiceLanguageFit(p.languages,language);
    const streamingFit=preferStreaming?(p.streaming?1:.55):.8;
    const localFit=p.local===false?.55:1;
    const success=Number.isFinite(perf.successRate)?perf.successRate:.7;
    const latency=latencyScore(perf.avgFinalLatencyMs,deviceProfile.tier);
    const lab=runtimeEvidenceAdjustment({engineId:engine.id,policy:runtimeEvidence});
    const scenario=scenarioEvidenceAdjustment({engineId:engine.id,scenarioEvidence});
    const outcome=outcomeValidationAdjustment({engineId:engine.id,validation:outcomeValidation});
    const evidenceBudget=composeEvidenceWeight({modality:'voice',lab:lab.delta,scenario:scenario.delta,outcome:outcome.delta});
    const score=languageFit*.24+streamingFit*.24+localFit*.16+success*.20+latency*.16+evidenceBudget.delta;
    return {engine,score,reasons:{languageFit,streamingFit,localFit,success,latency,labEvidence:lab,scenarioEvidence:scenario,outcomeValidation:outcome,evidenceBudget}};
  }).sort((a,b)=>b.score-a.score);
  return {schemaVersion:1,primary:ranked[0]??null,fallbacks:ranked.slice(1,3),ranked};
}
function latencyScore(ms,tier='balanced'){
  if(!Number.isFinite(Number(ms)))return .6;
  const target=tier==='low_power'?900:tier==='performance'?450:650;
  return Math.max(.1,Math.min(1,target/Math.max(target,Number(ms))));
}

function voiceLanguageFit(supported=[],requested='auto'){
  const langs=(supported??[]).map(x=>String(x).toLowerCase());
  const req=String(requested??'auto').toLowerCase();
  if(!langs.length||langs.includes('auto')||req==='auto')return 1;
  if(langs.includes('multilingual'))return 1;
  const base=req.split(/[-_]/)[0];
  if(langs.includes(req)||langs.includes(base))return 1;
  // A regional profile (for example es-MX) is still a strong fit for another
  // regional tag of the same language, while unrelated languages remain gated.
  if(langs.some(x=>x.split(/[-_]/)[0]===base))return .95;
  return .45;
}

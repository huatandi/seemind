import {evaluatePerceptionRelease} from './perception-release-gate.js';

export function selectPerceptionEngines({registry,arena,health,modality,capability,deviceProfile={},language='auto',targets={},localOnly=true}={}){
 const deviceKey=deviceKeyFor(deviceProfile);
 const candidates=registry.candidates({modality,capability,deviceProfile,language,localOnly}).map(({engine,profile})=>{
   const metrics=arena?.summarize?.({engineId:engine.id,modality,capability,deviceKey})??null;
   const gate=metrics?evaluatePerceptionRelease({metrics,targets}):null;
   const healthOk=health?.canUse?.(engine.id)!==false;
   const score=selectionScore({profile,metrics,gate,healthOk,deviceProfile});
   return {engine,profile,metrics,gate,healthOk,score};
 }).filter(x=>x.healthOk).sort((a,b)=>b.score-a.score);
 return {schemaVersion:1,deviceKey,primary:candidates[0]??null,fallbacks:candidates.slice(1,3),ranked:candidates};
}
export function deviceKeyFor(p={}){return [p.tier??'balanced',p.cores??'na',p.memoryGb??'na',p.webgpu?'gpu':'nogpu',p.mobile?'mobile':'desktop'].join(':')}
function selectionScore({profile,metrics,gate,deviceProfile}){
 let s=.45;
 if(gate?.passed)s+=.3;
 else if(gate&&gate.passed===false)s-=.18;
 if(metrics){s+=Math.min(.18,(metrics.successRate??0)*.12+(metrics.avgQuality??0)*.06);if(Number.isFinite(metrics.p50LatencyMs)){const target=deviceProfile.tier==='performance'?900:deviceProfile.tier==='low_power'?1400:1100;s+=Math.max(-.15,Math.min(.12,(target-metrics.p50LatencyMs)/target*.12))}}
 if(profile.qualityClass==='high')s+=.05;
 if(profile.streaming)s+=.02;
 return s;
}

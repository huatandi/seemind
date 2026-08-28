import {fuseMultimodalContext} from '../../multimodal/multimodal-fusion.js';
import {understandUniversalIntent} from '../../intent/universal-intent-router.js';
import {scoreMultimodalGrounding} from './multimodal-benchmark.js';
import {createMultimodalSession,addVisualObservation,addMultimodalTurn,resolveSessionReference} from '../../multimodal/multimodal-session.js';

export async function runMultimodalCase({case:c,resolveAsset,observeImage,conversation=[],session=null}={}){
 if(c?.modality!=='multimodal')throw codeError('MULTIMODAL_CASE_REQUIRED');
 const asset=await resolveAsset(c.assetRef);
 const started=performanceNow();
 const visual=await observeImage(asset,{language:c.language??'auto'});
 const raw=c.input?.speechText??c.speechText??c.input?.textInput??'';
 const conversationReference=session?resolveSessionReference(session,raw):null;
 const ctx=fuseMultimodalContext({visualObservation:visual,speechText:c.input?.speechText??c.speechText??'',textInput:c.input?.textInput??'',conversation,language:c.language??'auto',conversationReference});
 const intent=understandUniversalIntent({text:ctx.speech?.rawText??'',observation:visual});
 const actual={
  intent:normalizeIntent(intent.primary,ctx.userIntent?.value),
  reference:resolvedReference(ctx),
  target:resolvedTarget(ctx),
  stateOrProblem:resolvedState(ctx),
 };
 const score=scoreMultimodalGrounding({expected:c.expected??{},actual});
 if(session){addVisualObservation(session,visual);addMultimodalTurn(session,{speechText:c.input?.speechText??c.speechText??'',text:c.input?.textInput??'',context:ctx,visualObservation:visual})}
 return {caseId:c.id,ok:true,latencyMs:performanceNow()-started,visual,context:ctx,intent,actual,score,conversationReference};
}

export async function runSequentialMultimodalCases({cases=[],resolveAsset,observeImage,onProgress}={}){
 const session=createMultimodalSession(),results=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i];
  try{
   const r=await runMultimodalCase({case:c,resolveAsset,observeImage,conversation:session.turns,session});
   results.push(r);
  }catch(error){results.push({caseId:c.id,ok:false,error:{code:error?.code??'MULTIMODAL_CASE_FAILED',message:String(error?.message??error)}})}
  onProgress?.({completed:i+1,total:cases.length,caseId:c.id});
 }
 return {schemaVersion:1,session,results,continuitySuccessRate:continuityRate(cases,results)};
}
function continuityRate(cases,results){
 const pairs=cases.map((c,i)=>({c,r:results[i]})).filter(x=>x.c.expected?.conversationEntity||x.c.expected?.continuityReference);
 if(!pairs.length)return null;
 return pairs.filter(({c,r})=>r?.conversationReference?.resolved&&(r.conversationReference.entityId===c.expected.conversationEntity||r.conversationReference.label===c.expected.continuityReference)).length/pairs.length;
}

export async function runMultimodalCorpus({cases=[],resolveAsset,observeImage,onProgress}={}){
 const results=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i];
  try{results.push(await runMultimodalCase({case:c,resolveAsset,observeImage}))}
  catch(error){results.push({caseId:c.id,ok:false,error:{code:error?.code??'MULTIMODAL_CASE_FAILED',message:String(error?.message??error)}})}
  onProgress?.({completed:i+1,total:cases.length,caseId:c.id});
 }
 const scored=results.filter(x=>x.ok&&Number.isFinite(x.score?.score));
 const lat=results.filter(x=>x.ok).map(x=>x.latencyMs).sort((a,b)=>a-b);
 return {schemaVersion:1,results,summary:{cases:results.length,successRate:results.length?results.filter(x=>x.ok).length/results.length:0,avgGroundingScore:scored.length?scored.reduce((s,x)=>s+x.score.score,0)/scored.length:null,p50LatencyMs:percentile(lat,.5),p95LatencyMs:percentile(lat,.95)}};
}
function resolvedReference(ctx){
 const refs=ctx.references??[];
 const spatial=refs.find(x=>['right_side','left_side','upper_area','lower_area','this_region','that_region'].includes(x.type)&&x.groundedRegionId);
 if(spatial)return spatial.sourceText??spatial.type;
 const resolved=refs.find(x=>x.groundingStatus==='resolved'&&x.groundedRegionId);
 return resolved?.sourceText??resolved?.type??null;
}
function resolvedTarget(ctx){const r=(ctx.references??[]).find(x=>x.groundingStatus==='resolved');if(r?.groundedRegionId)return r.groundedRegionId;return ctx.visual?.facts?.find(x=>x.category==='identity')?.value??null}
function resolvedState(ctx){return ctx.symptoms?.[0]?.type??ctx.visual?.facts?.find(x=>x.category==='state')?.value??null}
function normalizeIntent(primary,fused){const map={identify:'identify',diagnose:'diagnose',solve:'solve',explain:'explain',safety:'safety',read:'read',translate:'translate'};return map[primary]??fused??primary}
function percentile(a,p){if(!a.length)return null;return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]}
function performanceNow(){return globalThis.performance?.now?.()??Date.now()}
function codeError(code){return Object.assign(new Error(code),{code})}

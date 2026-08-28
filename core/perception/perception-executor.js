import {deviceKeyFor} from './perception-engine-selector.js';

export async function executePerceptionRace({selection,input,capability,modality,arena,health,budget={},qualityEvaluator=null,onAttempt=null}={}){
 const order=[selection?.primary,...(selection?.fallbacks??[])].filter(Boolean);
 const attempts=[],deadline=Date.now()+Number(budget.totalLocalMs??3200);
 for(const candidate of order){
   if(Date.now()>=deadline)return {status:'budget_exhausted',attempts,reason:'PERCEPTION_BUDGET_EXHAUSTED'};
   const {engine}=candidate;const remaining=Math.max(1,deadline-Date.now());
   const timeoutMs=Math.min(remaining,Number(budget.perEngineTimeoutMs??remaining));
   const started=Date.now();
   try{
     const executed=await withTimeout(engine.infer(input,{capability,budget}),timeoutMs,'PERCEPTION_TIMEOUT');
     const result=executed.result??executed;
     const quality=qualityEvaluator?await qualityEvaluator(result,{engine,candidate}):inferQuality(result);
     const row={engineId:engine.id,modality,capability,deviceKey:selection.deviceKey??deviceKeyFor({}),latencyMs:Date.now()-started,ok:true,quality,loadMs:executed.loadMs??null,inferenceMs:executed.inferenceMs??null};
     arena?.record?.(row);health?.success?.(engine.id);
     attempts.push({engineId:engine.id,status:'completed',latencyMs:row.latencyMs,quality});onAttempt?.(attempts.at(-1));
     return {status:'completed',engineId:engine.id,result,quality,attempts};
   }catch(error){
     const code=String(error?.code??error?.message??'PERCEPTION_ENGINE_FAILED');
     const row={engineId:engine.id,modality,capability,deviceKey:selection.deviceKey??deviceKeyFor({}),latencyMs:Date.now()-started,ok:false,quality:null,errorCode:code};
     arena?.record?.(row);health?.failure?.(engine.id,code);
     attempts.push({engineId:engine.id,status:'failed',reason:code,latencyMs:row.latencyMs});onAttempt?.(attempts.at(-1));
   }
 }
 return {status:'failed',attempts,reason:'ALL_PERCEPTION_ENGINES_FAILED'};
}
async function withTimeout(promise,ms,code){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(code);e.code=code;reject(e)},ms)})])}finally{clearTimeout(timer)}
}
function inferQuality(r){const values=[r?.confidence?.overall,r?.confidence,r?.score].map(Number).filter(Number.isFinite);return values.length?Math.max(0,Math.min(1,values[0])):null}

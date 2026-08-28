export async function executeVoiceRecognition({route,listenOptions={},performanceStore=null,totalBudgetMs=3500,perEngineTimeoutMs=2500,onAttempt=null,outcomeStore=null,outcomeContext=null}={}){
 const order=[route?.primary,...(route?.fallbacks??[])].filter(Boolean);
 const attempts=[],started=Date.now();
 for(const candidate of order){
   if(Date.now()-started>=totalBudgetMs)return {status:'budget_exhausted',attempts,reason:'VOICE_BUDGET_EXHAUSTED'};
   const engine=candidate.engine;
   const remaining=Math.max(1,totalBudgetMs-(Date.now()-started));
   const timeout=Math.min(perEngineTimeoutMs,remaining);
   const engineStarted=Date.now();let firstPartialAt=null;
   try{
     const result=await withTimeout(engine.listen({
       ...listenOptions,
       onInterim:text=>{
         if(text&&!firstPartialAt)firstPartialAt=Date.now();
         listenOptions.onInterim?.(text);
       },
     }),timeout,'VOICE_ENGINE_TIMEOUT',()=>{try{engine.stop?.()}catch{}});
     const finalLatencyMs=Date.now()-engineStarted,partialLatencyMs=firstPartialAt?firstPartialAt-engineStarted:null;
     performanceStore?.record?.(engine.id,{ok:true,partialLatencyMs,finalLatencyMs});
     outcomeStore?.record?.({modality:'voice',engineId:engine.id,deviceKey:outcomeContext?.deviceKey??'default',scenarios:outcomeContext?.scenarios??[],kind:'technical',outcome:'success',meta:{partialLatencyMs,finalLatencyMs}});
     const attempt={engineId:engine.id,status:'completed',partialLatencyMs,finalLatencyMs};
     attempts.push(attempt);onAttempt?.(attempt);
     return {status:'completed',engineId:engine.id,result,attempts,partialLatencyMs,finalLatencyMs};
   }catch(error){
     const code=String(error?.code??error?.message??'VOICE_ENGINE_FAILED');
     const finalLatencyMs=Date.now()-engineStarted,partialLatencyMs=firstPartialAt?firstPartialAt-engineStarted:null;
     performanceStore?.record?.(engine.id,{ok:false,partialLatencyMs,finalLatencyMs});
     outcomeStore?.record?.({modality:'voice',engineId:engine.id,deviceKey:outcomeContext?.deviceKey??'default',scenarios:outcomeContext?.scenarios??[],kind:'technical',outcome:code==='VOICE_ENGINE_TIMEOUT'?'timeout':'failure',meta:{partialLatencyMs,finalLatencyMs,errorCode:code}});
     const attempt={engineId:engine.id,status:'failed',reason:code,partialLatencyMs,finalLatencyMs};
     attempts.push(attempt);onAttempt?.(attempt);
   }
 }
 return {status:'failed',attempts,reason:'ALL_VOICE_ENGINES_FAILED'};
}
async function withTimeout(promise,ms,code,onTimeout){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout?.();const e=new Error(code);e.code=code;reject(e)},ms)})])}finally{clearTimeout(timer)}
}

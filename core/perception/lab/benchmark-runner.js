import {BenchmarkSession} from './benchmark-session.js';

export async function runBenchmarkCases({engine,engineId=engine?.id,modality,cases=[],deviceProfile={},corpusId='pilot',resolveAsset,scoreCase,onProgress,signal}={}){
 if(!engineId)throw codeError('ENGINE_ID_REQUIRED');
 if(typeof resolveAsset!=='function')throw codeError('ASSET_RESOLVER_REQUIRED');
 if(typeof scoreCase!=='function')throw codeError('CASE_SCORER_REQUIRED');
 const session=new BenchmarkSession({engineId,modality,deviceProfile,corpusId});
 for(let i=0;i<cases.length;i++){
  if(signal?.aborted)throw codeError('BENCHMARK_ABORTED');
  const c=cases[i],started=performanceNow();
  try{
   const asset=await resolveAsset(c.assetRef,c);
   const memoryBefore=readMemoryMb();
   const raw=await execute(engine,modality,asset,c);
   const latencyMs=performanceNow()-started;
   const memoryAfter=readMemoryMb();
   const scored=await scoreCase({case:c,result:raw,latencyMs});
   const firstUsefulMs=numberOrNull(raw?.telemetry?.firstUsefulMs??raw?.firstUsefulMs);
   const memoryDeltaMb=memoryBefore!=null&&memoryAfter!=null?Math.max(0,memoryAfter-memoryBefore):numberOrNull(raw?.telemetry?.memoryDeltaMb);
   const budget=budgetFor(deviceProfile,modality);
   session.record({id:c.id,category:c.category,language:c.language,tags:c.tags??[],conditions:c.conditions??{},scenario:c.scenario??c.conditions?.scenario??null,
    ok:scored.ok!==false,latencyMs,firstUsefulMs,memoryDeltaMb,
    budgetExceeded:Boolean((firstUsefulMs!=null&&firstUsefulMs>budget.firstUsefulMs)||latencyMs>budget.totalMs||(memoryDeltaMb!=null&&budget.memoryMb!=null&&memoryDeltaMb>budget.memoryMb)),
    quality:scored.quality??null,details:scored.details??null});
  }catch(error){
   session.record({id:c.id,category:c.category,language:c.language,tags:c.tags??[],conditions:c.conditions??{},scenario:c.scenario??c.conditions?.scenario??null,ok:false,latencyMs:performanceNow()-started,quality:0,errorCode:String(error?.code??error?.message??'BENCHMARK_CASE_FAILED')});
  }
  onProgress?.({completed:i+1,total:cases.length,last:session.rows.at(-1)});
 }
 return session.finish();
}
async function execute(engine,modality,asset,c){
 if(modality==='vision'){
  if(typeof engine.infer==='function'){const x=await engine.infer(asset,{capability:c.capability??'general_vision',language:c.language,case:c});return x?.result??x}
  if(typeof engine.analyze==='function')return engine.analyze(asset,{capability:c.capability??'general_vision',language:c.language,case:c});
 }
 if(modality==='voice'){
  if(typeof engine.transcribeCase==='function')return engine.transcribeCase(asset,{language:c.language});
  if(typeof engine.transcribe==='function')return engine.transcribe(asset,{language:c.language});
 }
 if(modality==='multimodal'&&typeof engine.inferMultimodal==='function')return engine.inferMultimodal(asset,{case:c});
 throw codeError('ENGINE_BENCHMARK_METHOD_UNAVAILABLE');
}
function performanceNow(){return globalThis.performance?.now?.()??Date.now()}
function codeError(code){return Object.assign(new Error(code),{code})}

function readMemoryMb(){
 const n=Number(globalThis.performance?.memory?.usedJSHeapSize);
 return Number.isFinite(n)&&n>0?n/1048576:null;
}
function numberOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null}
function budgetFor(profile={},modality){
 const tier=profile.tier??'balanced',mobile=Boolean(profile.mobile);
 const firstUsefulMs=tier==='low_power'?1500:tier==='performance'?900:1100;
 const totalMs=tier==='low_power'?3500:tier==='performance'?6500:(mobile?4500:5500);
 const memoryMb=Number(profile.budgets?.maxVisualMemoryMb??null)||null;
 return {firstUsefulMs,totalMs,memoryMb:modality==='vision'||modality==='multimodal'?memoryMb:null};
}

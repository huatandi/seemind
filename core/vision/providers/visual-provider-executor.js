import {rankVisualProviders} from './visual-provider-router.js';
import {VisualRuntimeManager,withTimeout} from '../runtime/visual-runtime-manager.js';

const defaultRuntimeManager=new VisualRuntimeManager();

export async function executeVisualCapabilities({image,capabilities=[],providers=[],deviceClass='balanced',deviceBudget={},performanceStore=null,onEvent,runtimeManager=defaultRuntimeManager,timeoutMs=8000,loadTimeoutMs=15000,totalBudgetMs=null,benchmarkStore=null,deviceBenchmarkKey='default',autotunePolicy=null,runtimeEvidence=null,scenarioEvidence=null,outcomeValidation=null,outcomeStore=null,outcomeContext=null}={}){
  const pending=[...new Set(capabilities)],results=[],failures=[];
  const startedAt=Date.now();
  const deadlineAt=Number.isFinite(Number(totalBudgetMs))&&Number(totalBudgetMs)>0?startedAt+Number(totalBudgetMs):null;
  const remainingMs=()=>deadlineAt==null?Infinity:Math.max(0,deadlineAt-Date.now());
  for(let capabilityIndex=0;capabilityIndex<pending.length;capabilityIndex++){
    const capability=pending[capabilityIndex];
    if(remainingMs()<=0){
      const rest=pending.slice(capabilityIndex);
      for(const unresolvedCapability of rest)results.push({capability:unresolvedCapability,status:'unresolved',providerId:null,output:null,reason:'VISUAL_TOTAL_BUDGET_EXHAUSTED'});
      onEvent?.({type:'visual_budget_exhausted',unresolvedCapabilities:rest,elapsedMs:Date.now()-startedAt});
      break;
    }
    const ranked=await rankVisualProviders({providers,requiredCapabilities:[capability],deviceClass,deviceBudget,performanceStore,localOnly:true,autotunePolicy,runtimeEvidence,scenarioEvidence,outcomeValidation});
    let completed=false;
    for(const candidate of ranked){
      const provider=candidate.provider,started=Date.now();
      try{
        onEvent?.({type:'provider_started',providerId:provider.id,capability});
        let loadMs=0;
        if(typeof provider.load==='function'){
          const loadBudget=Math.max(1,Math.min(Number(loadTimeoutMs)||15000,remainingMs()));
          const loaded=await runtimeManager.ensureLoaded(provider,{timeoutMs:loadBudget});
          loadMs=Number(loaded?.loadMs??0);
        }
        const inferStarted=Date.now();
        const inferenceBudget=Math.max(1,Math.min(Number(timeoutMs)||8000,remainingMs()));
        if(remainingMs()<=0)throw Object.assign(new Error('VISUAL_TOTAL_BUDGET_EXHAUSTED'),{code:'VISUAL_TOTAL_BUDGET_EXHAUSTED'});
        const output=await withTimeout(provider.analyze(image,{capabilities:[capability],deviceClass,deviceBudget}),inferenceBudget,'VISUAL_PROVIDER_TIMEOUT');
        const inferenceMs=Date.now()-inferStarted;
        const latencyMs=Date.now()-started;
        performanceStore?.recordSuccess?.(provider.id,{latencyMs,capabilities:[capability]});
        benchmarkStore?.record?.(provider.id,capability,{ok:true,loadMs,inferenceMs},{deviceKey:deviceBenchmarkKey});
        outcomeStore?.record?.({modality:'vision',engineId:provider.id,deviceKey:outcomeContext?.deviceKey??deviceBenchmarkKey,scenarios:outcomeContext?.scenarios??scenarioEvidence?.scenarios??[],kind:'technical',outcome:'success',meta:{capability,latencyMs}});
        results.push({capability,providerId:provider.id,status:'ok',latencyMs,output});
        onEvent?.({type:'provider_succeeded',providerId:provider.id,capability,latencyMs});
        completed=true;break;
      }catch(error){
        const latencyMs=Date.now()-started,errorCode=safeCode(error);
        if(errorCode==='VISUAL_TOTAL_BUDGET_EXHAUSTED'){
          failures.push({capability,providerId:provider.id,errorCode,latencyMs});
          onEvent?.({type:'visual_budget_exhausted',unresolvedCapabilities:pending.slice(capabilityIndex),elapsedMs:Date.now()-startedAt});
          break;
        }
        performanceStore?.recordFailure?.(provider.id,{latencyMs,errorCode,capabilities:[capability]});
        benchmarkStore?.record?.(provider.id,capability,{ok:false,loadMs:0,inferenceMs:latencyMs,timeout:errorCode==='VISUAL_PROVIDER_TIMEOUT',errorCode},{deviceKey:deviceBenchmarkKey});
        outcomeStore?.record?.({modality:'vision',engineId:provider.id,deviceKey:outcomeContext?.deviceKey??deviceBenchmarkKey,scenarios:outcomeContext?.scenarios??scenarioEvidence?.scenarios??[],kind:'technical',outcome:errorCode==='VISUAL_PROVIDER_TIMEOUT'?'timeout':'failure',meta:{capability,latencyMs,errorCode}});
        failures.push({capability,providerId:provider.id,errorCode,latencyMs});
        onEvent?.({type:'provider_failed',providerId:provider.id,capability,errorCode});
      }
    }
    if(!completed)results.push({capability,status:'unresolved',providerId:null,output:null});
  }
  const unresolved=results.filter(x=>x.status!=='ok').map(x=>x.capability);
  return {
    schemaVersion:1,
    results,failures,unresolvedCapabilities:unresolved,runtime:runtimeManager.snapshot(),
    escalation:unresolved.length?{needed:true,preferredKinds:['vision'],unresolvedCapabilities:unresolved,sendPolicy:'minimum_necessary'}:{needed:false},
  };
}
function safeCode(error){const c=String(error?.code??error?.message??'VISUAL_PROVIDER_FAILED');return /^[A-Z0-9_:-]{3,80}$/.test(c)?c:'VISUAL_PROVIDER_FAILED'}

/**
 * Conservative runtime warmup coordinator.
 * Warmup is an optimization hint only: never downloads models, never routes a
 * task, and never blocks first-useful work. Heavy providers remain on-demand.
 */
export function createRuntimeWarmup({deviceProfile={},now=()=>Date.now(),idleScheduler=null}={}){
  const records=new Map();
  const scheduler=idleScheduler??defaultIdleScheduler;
  const policy=warmupPolicy(deviceProfile);
  async function run(id,fn,{cost='light',reason='idle'}={}){
    if(typeof fn!=='function')return result(id,'skipped','NO_WARMUP_HANDLER');
    if(records.get(id)?.state==='ready')return records.get(id);
    if(!policy.allowedCosts.includes(cost))return remember(result(id,'skipped','DEVICE_POLICY'));
    const startedAt=now();
    try{await fn();return remember({schemaVersion:1,kind:'runtime_warmup',id,state:'ready',cost,reason,startedAt,completedAt:now(),durationMs:Math.max(0,now()-startedAt),policy});}
    catch(error){return remember({schemaVersion:1,kind:'runtime_warmup',id,state:'failed',cost,reason,startedAt,completedAt:now(),durationMs:Math.max(0,now()-startedAt),errorCode:String(error?.code??error?.message??'WARMUP_FAILED'),policy});}
  }
  function schedule(id,fn,opts={}){
    if(!policy.idleWarmup)return {cancel(){},scheduled:false,reason:'DEVICE_POLICY'};
    let cancelled=false;
    const cancel=scheduler(()=>{if(!cancelled)run(id,fn,opts)},policy.idleTimeoutMs);
    return {scheduled:true,cancel(){cancelled=true;cancel?.()}};
  }
  function snapshot(){return {schemaVersion:1,kind:'runtime_warmup_state',policy,records:[...records.values()]}}
  function remember(x){records.set(x.id,x);return x}
  function result(id,state,reason){return {schemaVersion:1,kind:'runtime_warmup',id,state,reason,policy}}
  return {policy,run,schedule,snapshot};
}

export function warmupPolicy(profile={}){
  const tier=profile.tier??'balanced',saveData=Boolean(profile.connection?.saveData),constrained=Boolean(profile.connection?.constrained);
  if(tier==='low_power'||saveData)return Object.freeze({idleWarmup:false,allowedCosts:['tiny'],idleTimeoutMs:1800,heavyModelsOnDemandOnly:true,noModelDownloads:true});
  if(tier==='performance'&&!constrained)return Object.freeze({idleWarmup:true,allowedCosts:['tiny','light','medium'],idleTimeoutMs:1200,heavyModelsOnDemandOnly:true,noModelDownloads:true});
  return Object.freeze({idleWarmup:true,allowedCosts:['tiny','light'],idleTimeoutMs:1500,heavyModelsOnDemandOnly:true,noModelDownloads:true});
}

export function classifyStartupSample({firstRun=false,previousUseAt=null,now=Date.now(),warmWindowMs=5*60*1000}={}){
  if(firstRun||previousUseAt==null)return 'cold';
  return now-previousUseAt<=warmWindowMs?'hot':'warm';
}

function defaultIdleScheduler(fn,timeout){
  if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(fn,{timeout});return()=>cancelIdleCallback?.(id)}
  const id=setTimeout(fn,Math.min(250,timeout));return()=>clearTimeout(id);
}

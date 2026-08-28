export class VisualRuntimeManager {
  constructor(){this.states=new Map()}
  async ensureLoaded(provider,{timeoutMs=15000}={}){
    const id=provider.id,state=this.states.get(id)??{status:'unloaded',promise:null,lastErrorCode:null,loadedAt:null};
    if(state.status==='loaded')return {status:'loaded',providerId:id,reused:true,loadMs:0};
    if(state.promise)return state.promise;
    const started=Date.now();
    const promise=withTimeout(Promise.resolve().then(()=>provider.load?.()),timeoutMs,'VISUAL_PROVIDER_LOAD_TIMEOUT')
      .then(()=>{
        const loadMs=Date.now()-started;
        const next={status:'loaded',promise:null,lastErrorCode:null,loadedAt:new Date().toISOString(),lastLoadMs:loadMs};
        this.states.set(id,next);return {status:'loaded',providerId:id,reused:false,loadMs};
      })
      .catch(error=>{
        const next={status:'failed',promise:null,lastErrorCode:safeCode(error),loadedAt:null};
        this.states.set(id,next);throw error;
      });
    this.states.set(id,{...state,status:'loading',promise});
    return promise;
  }
  async unload(provider){
    try{await provider.unload?.()}finally{this.states.set(provider.id,{status:'unloaded',promise:null,lastErrorCode:null,loadedAt:null})}
  }
  state(id){return this.states.get(String(id))??{status:'unloaded',promise:null,lastErrorCode:null,loadedAt:null}}
  snapshot(){return Object.fromEntries([...this.states].map(([k,v])=>[k,{status:v.status,lastErrorCode:v.lastErrorCode,loadedAt:v.loadedAt,lastLoadMs:v.lastLoadMs??null}]))}
}
export async function withTimeout(promise,ms,code='VISUAL_PROVIDER_TIMEOUT'){
  if(!Number.isFinite(Number(ms))||Number(ms)<=0)return promise;
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(code),{code})),Number(ms))})
    ]);
  }finally{clearTimeout(timer)}
}
function safeCode(error){const c=String(error?.code??error?.message??'VISUAL_PROVIDER_FAILED');return /^[A-Z0-9_:-]{3,80}$/.test(c)?c:'VISUAL_PROVIDER_FAILED'}

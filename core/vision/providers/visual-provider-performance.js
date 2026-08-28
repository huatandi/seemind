export class VisualProviderPerformanceStore {
  constructor(){this.map=new Map()}
  recordSuccess(id,{latencyMs=0,capabilities=[]}={}){this.#update(id,true,latencyMs,capabilities)}
  recordFailure(id,{latencyMs=0,errorCode='VISUAL_PROVIDER_FAILED',capabilities=[]}={}){this.#update(id,false,latencyMs,capabilities,errorCode)}
  get(id){return this.map.get(String(id))??null}
  snapshot(){return Object.fromEntries(this.map)}
  #update(id,ok,latencyMs,capabilities,errorCode=null){
    const k=String(id),x=this.map.get(k)??{attempts:0,successes:0,failures:0,avgLatencyMs:null,lastErrorCode:null,capabilities:{}};
    x.attempts++;if(ok)x.successes++;else x.failures++;
    x.avgLatencyMs=x.avgLatencyMs==null?Number(latencyMs):(x.avgLatencyMs*(x.attempts-1)+Number(latencyMs))/x.attempts;
    x.lastErrorCode=errorCode;
    for(const c of capabilities){const y=x.capabilities[c]??{attempts:0,successes:0};y.attempts++;if(ok)y.successes++;x.capabilities[c]=y}
    this.map.set(k,x);
  }
}

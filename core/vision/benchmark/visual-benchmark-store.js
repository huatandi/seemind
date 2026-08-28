export class VisualBenchmarkStore {
  constructor({storageKey='seemind.visual-benchmarks.v1'}={}){
    this.storageKey=storageKey;
    this.memory={};
  }
  get(providerId,capability='*',deviceKey='default'){
    const all=this.#load();
    return all[key(providerId,capability,deviceKey)]??null;
  }
  record(providerId,capability,result,{deviceKey='default'}={}){
    const all=this.#load(),k=key(providerId,capability,deviceKey);
    const prev=all[k]??{
      providerId,capability,deviceKey,runs:0,successes:0,failures:0,timeouts:0,
      avgLoadMs:null,avgInferenceMs:null,maxInferenceMs:0,lastErrorCode:null,lastUpdatedAt:null,
    };
    prev.runs++;
    if(result.ok)prev.successes++;else prev.failures++;
    if(result.timeout)prev.timeouts++;
    if(Number.isFinite(Number(result.loadMs)))prev.avgLoadMs=rolling(prev.avgLoadMs,Number(result.loadMs),prev.runs);
    if(Number.isFinite(Number(result.inferenceMs))){
      const ms=Number(result.inferenceMs);
      prev.avgInferenceMs=rolling(prev.avgInferenceMs,ms,prev.runs);
      prev.maxInferenceMs=Math.max(prev.maxInferenceMs??0,ms);
    }
    prev.lastErrorCode=result.errorCode??null;
    prev.lastUpdatedAt=new Date().toISOString();
    all[k]=prev;this.#save(all);return {...prev};
  }
  list({deviceKey=null}={}){
    const all=Object.values(this.#load());
    return deviceKey==null?all:all.filter(x=>x.deviceKey===deviceKey);
  }
  clear(){this.memory={};try{localStorage.removeItem(this.storageKey)}catch{}}
  #load(){try{return JSON.parse(localStorage.getItem(this.storageKey)||'{}')}catch{return {...this.memory}}}
  #save(v){this.memory={...v};try{localStorage.setItem(this.storageKey,JSON.stringify(v))}catch{}}
}
export function deviceBenchmarkKey(profile={}){
  return [profile.tier??'unknown',profile.cores??'na',profile.memoryGb??'na',profile.webgpu?'gpu':'nogpu',profile.mobile?'mobile':'desktop'].join(':');
}
function key(p,c,d){return `${d}|${p}|${c}`}
function rolling(prev,next,n){return prev==null?next:((prev*(n-1))+next)/n}

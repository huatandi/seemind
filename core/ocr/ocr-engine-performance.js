export class OcrEnginePerformanceStore{
  constructor(seed={}){
    this.stats=new Map();
    for(const [id,value] of Object.entries(seed||{}))this.stats.set(id,normalize(value));
  }
  recordSuccess(engineId,{latencyMs=null,score=null}={}){
    const s=this.get(engineId);
    s.attempts++;s.successes++;
    if(Number.isFinite(Number(latencyMs)))s.avgLatencyMs=rolling(s.avgLatencyMs,Number(latencyMs),s.successes);
    if(Number.isFinite(Number(score)))s.avgEvidenceScore=rolling(s.avgEvidenceScore,Number(score),s.successes);
    s.consecutiveFailures=0;s.lastStatus='success';s.updatedAt=Date.now();
    this.stats.set(String(engineId),s);return {...s};
  }
  recordFailure(engineId){
    const s=this.get(engineId);
    s.attempts++;s.failures++;s.consecutiveFailures++;s.lastStatus='failure';s.updatedAt=Date.now();
    this.stats.set(String(engineId),s);return {...s};
  }
  get(engineId){
    return normalize(this.stats.get(String(engineId))??{});
  }
  snapshot(){
    return Object.fromEntries([...this.stats].map(([id,s])=>[id,{...s,successRate:rate(s)}]));
  }
  publicStats(engineId){
    const s=this.get(engineId);
    return {...s,successRate:rate(s),routingSuccessRate:smoothedRate(s)};
  }
  export(){return this.snapshot()}
}

export class LocalStorageOcrEnginePerformanceStore extends OcrEnginePerformanceStore{
  constructor({storage=globalThis.localStorage,key='seemind:ocr-engine-performance:v1'}={}){
    super(load(storage,key));this.storage=storage;this.key=key;
  }
  recordSuccess(engineId,meta={}){const r=super.recordSuccess(engineId,meta);this.persist();return r}
  recordFailure(engineId,meta={}){const r=super.recordFailure(engineId,meta);this.persist();return r}
  persist(){
    try{this.storage?.setItem?.(this.key,JSON.stringify(this.export()))}catch{}
  }
  clear(){
    this.stats.clear();
    try{this.storage?.removeItem?.(this.key)}catch{}
  }
}
function normalize(v){
  return {
    attempts:Number(v.attempts)||0,successes:Number(v.successes)||0,failures:Number(v.failures)||0,
    avgLatencyMs:Number.isFinite(Number(v.avgLatencyMs))?Number(v.avgLatencyMs):null,
    avgEvidenceScore:Number.isFinite(Number(v.avgEvidenceScore))?Number(v.avgEvidenceScore):null,
    consecutiveFailures:Number(v.consecutiveFailures)||0,lastStatus:v.lastStatus??'unknown',updatedAt:Number(v.updatedAt)||0,
  };
}
function rate(s){return s.attempts?Math.round((s.successes/s.attempts)*1000)/1000:null}
function smoothedRate(s){
  // Beta prior centered at 0.75: 3 virtual successes / 1 virtual failure.
  return Math.round(((s.successes+3)/(s.attempts+4))*1000)/1000;
}
function load(storage,key){
  try{const raw=storage?.getItem?.(key);return raw?JSON.parse(raw):{}}catch{return {}}
}
function rolling(prev,value,n){return prev==null?value:Math.round(((prev*(n-1)+value)/n)*10)/10}

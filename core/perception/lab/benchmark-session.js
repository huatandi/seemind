export class BenchmarkSession{
 constructor({engineId,modality,deviceProfile={},corpusId='default'}={}){
  this.meta={schemaVersion:1,sessionId:cryptoId(),engineId,modality,corpusId,deviceProfile,startedAt:new Date().toISOString()};
  this.rows=[];
 }
 record(row){this.rows.push({...row,recordedAt:new Date().toISOString()});return this.rows.at(-1)}
 finish(){
  const completedAt=new Date().toISOString();
  return {...this.meta,completedAt,rows:[...this.rows],summary:summarize(this.rows)};
 }
}
function summarize(rows){
 const good=rows.filter(x=>x.ok),lat=good.map(x=>Number(x.latencyMs)).filter(Number.isFinite).sort((a,b)=>a-b);
 const first=good.map(x=>Number(x.firstUsefulMs)).filter(Number.isFinite).sort((a,b)=>a-b);
 const mem=rows.map(x=>Number(x.memoryDeltaMb)).filter(Number.isFinite).sort((a,b)=>a-b);
 const q=good.map(x=>Number(x.quality)).filter(Number.isFinite);
 return {cases:rows.length,successRate:rows.length?good.length/rows.length:0,avgQuality:q.length?q.reduce((a,b)=>a+b,0)/q.length:null,
  p50LatencyMs:pct(lat,.5),p95LatencyMs:pct(lat,.95),
  p50FirstUsefulMs:pct(first,.5),p95FirstUsefulMs:pct(first,.95),
  p95MemoryDeltaMb:pct(mem,.95),
  budgetExceededRate:rows.length?rows.filter(x=>x.budgetExceeded).length/rows.length:0};
}
function pct(a,p){return a.length?a[Math.min(a.length-1,Math.floor((a.length-1)*p))]:null}
function cryptoId(){return globalThis.crypto?.randomUUID?.()??`lab-${Date.now()}-${Math.random().toString(36).slice(2)}`}

export function buildBenchmarkReport({sessions=[],corpusValidation=null}={}){
 const engines=new Map();
 for(const s of sessions){
  const key=`${s.modality}|${s.engineId}`;
  const arr=engines.get(key)??[];arr.push(s);engines.set(key,arr);
 }
 const comparisons=[...engines.entries()].map(([key,rows])=>{
   const [modality,engineId]=key.split('|');
   const summaries=rows.map(x=>x.summary??{}),cases=summaries.reduce((n,x)=>n+Number(x.cases??0),0);
   return {modality,engineId,sessions:rows.length,cases,
     successRate:weighted(summaries,'successRate','cases'),
     avgQuality:weighted(summaries,'avgQuality','cases'),
     p50LatencyMs:median(summaries.map(x=>x.p50LatencyMs).filter(Number.isFinite)),
     p95LatencyMs:median(summaries.map(x=>x.p95LatencyMs).filter(Number.isFinite)),
   };
 }).sort((a,b)=>(b.avgQuality??0)-(a.avgQuality??0));
 return {schemaVersion:1,generatedAt:new Date().toISOString(),corpusValidation,comparisons};
}
export function exportBenchmarkJson(report){return JSON.stringify(report,null,2)}
function weighted(rows,k,w){let n=0,d=0;for(const r of rows){const v=Number(r[k]),x=Number(r[w]??1);if(Number.isFinite(v)){n+=v*x;d+=x}}return d?n/d:null}
function median(a){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}

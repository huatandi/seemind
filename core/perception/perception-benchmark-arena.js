export class PerceptionBenchmarkArena{
 constructor(){this.records=[]}
 record({engineId,modality,capability,deviceKey='default',latencyMs,ok=true,quality=null,memoryMb=null,errorCode=null}={}){
  const row={engineId,modality,capability,deviceKey,latencyMs:Number(latencyMs),ok:Boolean(ok),quality:quality==null?null:Number(quality),memoryMb:memoryMb==null?null:Number(memoryMb),errorCode,at:Date.now()};
  this.records.push(row);if(this.records.length>4000)this.records.splice(0,this.records.length-4000);return row;
 }
 summarize({engineId,modality,capability,deviceKey}={}){
  const rows=this.records.filter(x=>(!engineId||x.engineId===engineId)&&(!modality||x.modality===modality)&&(!capability||x.capability===capability)&&(!deviceKey||x.deviceKey===deviceKey));
  if(!rows.length)return null;
  const good=rows.filter(x=>x.ok),lat=good.map(x=>x.latencyMs).filter(Number.isFinite).sort((a,b)=>a-b),quality=good.map(x=>x.quality).filter(Number.isFinite);
  return {runs:rows.length,successRate:good.length/rows.length,p50LatencyMs:pct(lat,.5),p95LatencyMs:pct(lat,.95),avgQuality:quality.length?quality.reduce((a,b)=>a+b,0)/quality.length:null};
 }
}
function pct(a,p){if(!a.length)return null;return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]}

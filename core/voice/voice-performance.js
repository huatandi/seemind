export class VoicePerformanceStore{
  constructor(){this.map=new Map()}
  get(id){return this.map.get(id)??{}}
  record(id,{ok=true,partialLatencyMs=null,finalLatencyMs=null,intentCorrect=null}={}){
    const p=this.get(id),attempts=(p.attempts??0)+1,successes=(p.successes??0)+(ok?1:0);
    const next={...p,attempts,successes,successRate:successes/attempts};
    if(Number.isFinite(Number(partialLatencyMs)))next.avgPartialLatencyMs=roll(p.avgPartialLatencyMs,p.partialSamples??0,Number(partialLatencyMs)),next.partialSamples=(p.partialSamples??0)+1;
    if(Number.isFinite(Number(finalLatencyMs)))next.avgFinalLatencyMs=roll(p.avgFinalLatencyMs,p.finalSamples??0,Number(finalLatencyMs)),next.finalSamples=(p.finalSamples??0)+1;
    if(intentCorrect!=null){next.intentSamples=(p.intentSamples??0)+1;next.intentCorrect=(p.intentCorrect??0)+(intentCorrect?1:0);next.intentAccuracy=next.intentCorrect/next.intentSamples}
    this.map.set(id,next);return next;
  }
  snapshot(){return Object.fromEntries(this.map)}
}
function roll(prev,n,value){return n?((Number(prev)||0)*n+value)/(n+1):value}

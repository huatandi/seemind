/**
 * Low-overhead monotonic timing trace for the real mobile perception path.
 * Telemetry only: it has no routing, evidence, or answer authority.
 */
export function createCriticalPathTrace({startedAt=nowMs(),now=nowMs}={}){
  const marks=[],spans=[],open=new Map();
  function mark(name,meta={}){
    const at=now(); const item=Object.freeze({name,atMs:round(at-startedAt),meta:{...meta}});marks.push(item);return item;
  }
  function start(name,meta={}){
    if(open.has(name))return null;
    const at=now();open.set(name,{at,meta:{...meta}});return {name,atMs:round(at-startedAt)};
  }
  function end(name,meta={}){
    const item=open.get(name);if(!item)return null;open.delete(name);
    const observedAt=now();const at=Math.max(item.at,observedAt);const span=Object.freeze({name,startMs:round(Math.max(0,item.at-startedAt)),endMs:round(Math.max(0,at-startedAt)),durationMs:round(Math.max(0,at-item.at)),meta:{...item.meta,...meta,...(observedAt<item.at?{clockRegression:true}:{})}});spans.push(span);return span;
  }
  function record(name,durationMs,meta={}){
    const requestedDuration=Math.max(0,Number(durationMs)||0);const at=now();
    const elapsed=Math.max(0,at-startedAt);
    // External timers can start before this trace. Clamp their interval to the
    // trace lifetime so the emitted span remains internally consistent and does
    // not get discarded as malformed by analyzeCriticalPath(). Preserve the raw
    // measurement for diagnostics instead of silently losing it.
    const duration=Math.min(requestedDuration,elapsed);
    const span=Object.freeze({name,startMs:round(elapsed-duration),endMs:round(elapsed),durationMs:round(duration),meta:{...meta,measuredExternally:true,...(requestedDuration>elapsed?{externalDurationMs:round(requestedDuration),clampedToTrace:true}:{})}});spans.push(span);return span;
  }
  function snapshot({completedAt=now()}={}){
    const closed=[...spans].sort((a,b)=>a.startMs-b.startMs);
    const bottlenecks=[...closed].sort((a,b)=>b.durationMs-a.durationMs).slice(0,5);
    const firstUseful=marks.find(x=>x.name==='first_useful');
    return Object.freeze({schemaVersion:1,kind:'critical_path_trace',totalMs:round(Math.max(0,completedAt-startedAt)),firstUsefulMs:firstUseful?.atMs??null,openStages:[...open.keys()],marks:[...marks],spans:closed,bottlenecks,
      longestStage:bottlenecks[0]?.name??null,longestStageMs:bottlenecks[0]?.durationMs??0,
      policy:{telemetryOnly:true,noRoutingAuthority:true,optimizeMeasuredBottleneckFirst:true}});
  }
  return {mark,start,end,record,snapshot,startedAt};
}

export function analyzeCriticalPath(trace={}){
 const spans=[...(trace.spans??[])];const total=Math.max(1,Number(trace.totalMs??0));
 const validSpans=spans.filter(validSpan);
 const rankableSpans=spans.filter(rankableSpan);
 const inRangeSpans=rankableSpans.filter(x=>spanWithinTotal(x,total));
 const ranked=inRangeSpans.map(x=>({...x,share:round(Number(x.durationMs??0)/total)})).sort(compareDuration);
 const repeatedDecode=inRangeSpans.filter(x=>/decode/i.test(String(x.name??''))).length>1;
 const actionable=ranked.filter(x=>!containsNestedSpan(x,inRangeSpans)).map(x=>({...x,exclusiveMs:exclusiveDuration(x,inRangeSpans)})).sort((a,b)=>b.exclusiveMs-a.exclusiveMs||compareDuration(a,b));
 const coveredMs=Math.min(total,unionDuration(validSpans));const unaccountedMs=Math.max(0,round(total-coveredMs));
 const rawFirstUsefulMs=finiteNonNegative(trace.firstUsefulMs);
 const firstUsefulMs=rawFirstUsefulMs==null?null:Math.min(total,rawFirstUsefulMs);
 const firstUsefulOutOfRange=rawFirstUsefulMs!=null&&rawFirstUsefulMs>total;
 const preUsefulSpans=firstUsefulMs==null?[]:ranked.map(x=>({...x,preFirstUsefulMs:overlapDuration(x,0,firstUsefulMs)})).filter(x=>x.preFirstUsefulMs>0).sort((a,b)=>b.preFirstUsefulMs-a.preFirstUsefulMs||compareDuration(a,b));
 const beforeFirstUsefulMs=firstUsefulMs==null?null:Math.min(total,firstUsefulMs);
 const afterFirstUsefulMs=firstUsefulMs==null?null:Math.max(0,round(total-beforeFirstUsefulMs));
 const openStages=[...(trace.openStages??[])];
 const malformedCount=spans.length-rankableSpans.length;
 const outOfRangeCount=rankableSpans.length-inRangeSpans.length;
 const duplicateNames=duplicateStageNames(inRangeSpans);
 const preUsefulActionable=firstUsefulMs==null?[]:actionable.map(x=>({...x,preFirstUsefulMs:overlapDuration(x,0,firstUsefulMs)})).filter(x=>x.preFirstUsefulMs>0).sort((a,b)=>b.preFirstUsefulMs-a.preFirstUsefulMs||b.exclusiveMs-a.exclusiveMs||compareDuration(a,b));
 const optimizationTarget=preUsefulActionable[0]??preUsefulSpans[0]??actionable[0]??ranked[0]??null;
 const warnings=[...(repeatedDecode?['REPEATED_IMAGE_DECODE']:[]),...(unaccountedMs/total>.2?['SIGNIFICANT_UNACCOUNTED_LATENCY']:[]),...(openStages.length?['OPEN_TIMING_STAGES']:[]),...(malformedCount?['MALFORMED_TIMING_SPANS']:[]),...(duplicateNames.length?['REPEATED_STAGE_MEASUREMENTS']:[]),...(firstUsefulOutOfRange?['FIRST_USEFUL_OUT_OF_RANGE']:[]),...(outOfRangeCount?['OUT_OF_RANGE_TIMING_SPANS']:[])];
 return {schemaVersion:1,kind:'critical_path_analysis',totalMs:Number(trace.totalMs??0),ranked,bottleneck:ranked[0]??null,actionableBottleneck:actionable[0]??ranked[0]??null,optimizationTarget,preUsefulSpans,preUsefulActionable,coveredMs,unaccountedMs,firstUsefulMs,beforeFirstUsefulMs,afterFirstUsefulMs,malformedCount,outOfRangeCount,duplicateStageNames:duplicateNames,
   instrumentationHealth:openStages.length||malformedCount||outOfRangeCount||firstUsefulOutOfRange?'degraded':unaccountedMs/total>.2?'partial':'healthy',warnings,policy:'MEASURE_BEFORE_OPTIMIZE'};
}
function unionDuration(spans){
 const ranges=spans.map(x=>[Number(x.startMs),Number(x.endMs)]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>=a).sort((a,b)=>a[0]-b[0]);if(!ranges.length)return 0;let total=0,[start,end]=ranges[0];for(const [a,b] of ranges.slice(1)){if(a<=end)end=Math.max(end,b);else{total+=end-start;start=a;end=b}}return round(total+end-start);
}
function containsNestedSpan(parent,spans){
 const ps=Number(parent.startMs),pe=Number(parent.endMs);if(!Number.isFinite(ps)||!Number.isFinite(pe))return false;
 return spans.some(child=>child!==parent&&Number.isFinite(Number(child.startMs))&&Number.isFinite(Number(child.endMs))&&Number(child.startMs)>=ps&&Number(child.endMs)<=pe&&Number(child.durationMs)<Number(parent.durationMs));
}
function exclusiveDuration(span,spans){
 const start=Number(span.startMs),end=Number(span.endMs);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return Math.max(0,Number(span.durationMs)||0);
 const nested=spans.filter(x=>!sameSpan(x,span)&&Number(x.startMs)>=start&&Number(x.endMs)<=end&&Number(x.endMs)>Number(x.startMs)).map(x=>({startMs:Number(x.startMs),endMs:Number(x.endMs)}));
 return Math.max(0,round((end-start)-unionDuration(nested)));
}
function validSpan(x){const a=Number(x?.startMs),b=Number(x?.endMs),d=Number(x?.durationMs);return Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(d)&&a>=0&&b>=a&&d>=0&&Math.abs((b-a)-d)<=1}
function rankableSpan(x){const d=Number(x?.durationMs);if(!Number.isFinite(d)||d<0)return false;const hasStart=x?.startMs!=null,hasEnd=x?.endMs!=null;if(!hasStart&&!hasEnd)return true;return validSpan(x)}
function spanWithinTotal(x,total){if(x?.startMs==null&&x?.endMs==null)return Number(x.durationMs)<=total;return Number(x.startMs)<=total&&Number(x.endMs)<=total}
function overlapDuration(span,start,end){const a=Math.max(Number(span?.startMs)||0,start),b=Math.min(Number(span?.endMs)||0,end);return round(Math.max(0,b-a))}
function duplicateStageNames(spans){const counts=new Map();for(const x of spans)counts.set(x.name,(counts.get(x.name)||0)+1);return [...counts].filter(([,n])=>n>1).map(([name])=>name).sort()}
function sameSpan(a,b){return a===b||(a?.name===b?.name&&Number(a?.startMs)===Number(b?.startMs)&&Number(a?.endMs)===Number(b?.endMs))}
function compareDuration(a,b){return Number(b.durationMs??0)-Number(a.durationMs??0)||Number(a.startMs??0)-Number(b.startMs??0)||String(a.name??'').localeCompare(String(b.name??''))}
function finiteNonNegative(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function nowMs(){return globalThis.performance?.now?.()??Date.now()}
function round(n){return Math.round(Number(n)*100)/100}

export function compareAgainstBaseline(candidate={},baseline={}){
 const delta=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))?Number(a)-Number(b):null;
 const ratio=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Number(b)!==0?Number(a)/Number(b):null;
 const out={
  qualityDelta:delta(candidate.avgQuality,baseline.avgQuality),
  successDelta:delta(candidate.successRate,baseline.successRate),
  p50LatencyRatio:ratio(candidate.p50LatencyMs,baseline.p50LatencyMs),
  p95LatencyRatio:ratio(candidate.p95LatencyMs,baseline.p95LatencyMs),
 };
 out.verdict=verdict(out);
 return out;
}
function verdict(x){
 if(x.qualityDelta!=null&&x.qualityDelta<-.03)return 'REGRESSION';
 if(x.successDelta!=null&&x.successDelta<-.02)return 'REGRESSION';
 if(x.p50LatencyRatio!=null&&x.p50LatencyRatio>1.35)return 'REGRESSION';
 if((x.qualityDelta??0)>=.03&&(x.p50LatencyRatio??1)<=1.2)return 'IMPROVEMENT';
 if((x.p50LatencyRatio??1)<=.75&&(x.qualityDelta??0)>=-.01)return 'IMPROVEMENT';
 return 'MIXED_OR_TIE';
}

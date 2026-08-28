import {evaluatePerceptionRelease} from '../perception-release-gate.js';

export function evaluateEnginePromotion({engineId,modality,metrics,baseline=null,targets={},minimumCases=12}={}){
 const enoughCases=Number(metrics?.cases??metrics?.runs??0)>=minimumCases;
 const gate=evaluatePerceptionRelease({metrics:{
   successRate:metrics?.successRate,
   avgQuality:metrics?.avgQuality,
   p50LatencyMs:metrics?.p50LatencyMs,
   p95LatencyMs:metrics?.p95LatencyMs,
 },targets});
 const regressions=[];
 if(baseline){
   if(Number.isFinite(metrics?.avgQuality)&&Number.isFinite(baseline?.avgQuality)&&metrics.avgQuality<baseline.avgQuality-.03)regressions.push('QUALITY_REGRESSION');
   if(Number.isFinite(metrics?.p50LatencyMs)&&Number.isFinite(baseline?.p50LatencyMs)&&metrics.p50LatencyMs>baseline.p50LatencyMs*1.35)regressions.push('P50_LATENCY_REGRESSION');
   if(Number.isFinite(metrics?.successRate)&&Number.isFinite(baseline?.successRate)&&metrics.successRate<baseline.successRate-.02)regressions.push('RELIABILITY_REGRESSION');
 }
 const promoted=enoughCases&&gate.passed&&!regressions.length;
 return {
   schemaVersion:1,engineId,modality,promoted,enoughCases,gate,regressions,
   action:promoted?'eligible_for_canary':'keep_in_lab',
   principle:'No engine becomes default from reputation or one demo; it must beat release criteria on target-device cases.',
 };
}

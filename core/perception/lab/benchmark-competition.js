import {runBenchmarkCases} from './benchmark-runner.js';
import {compareAgainstBaseline} from './baseline-comparator.js';
import {evaluateEnginePromotion} from './engine-promotion-policy.js';
import {buildBenchmarkReport} from './benchmark-report.js';
import {analyzeFailurePatterns,buildRemediationHints} from './failure-pattern-analyzer.js';

export async function runEngineCompetition({engines=[],modality,cases=[],deviceProfile={},corpusId='pilot',resolveAsset,scoreCase,baselineEngineId=null,onProgress}={}){
 const sessions=[];
 for(let i=0;i<engines.length;i++){
  const engine=engines[i];
  const session=await runBenchmarkCases({
   engine,engineId:engine.id,modality,cases,deviceProfile,corpusId,resolveAsset,scoreCase,
   onProgress:e=>onProgress?.({engineId:engine.id,engineIndex:i+1,engineTotal:engines.length,...e})
  });
  sessions.push(session);
 }
 const report=buildBenchmarkReport({sessions});
 const baseline=report.comparisons.find(x=>x.engineId===baselineEngineId)??report.comparisons[0]??null;
 const decisions=report.comparisons.map(metrics=>{
  const comparison=baseline&&metrics.engineId!==baseline.engineId?compareAgainstBaseline(metrics,baseline):null;
  const promotion=evaluateEnginePromotion({engineId:metrics.engineId,modality,metrics,baseline:metrics.engineId===baseline?.engineId?null:baseline,minimumCases:12});
  return {engineId:metrics.engineId,metrics,baselineEngineId:baseline?.engineId??null,comparison,promotion};
 });
 const failureAnalysis=analyzeFailurePatterns({sessions,modality});
 const remediationHints=buildRemediationHints(failureAnalysis);
 return {schemaVersion:2,modality,corpusId,baselineEngineId:baseline?.engineId??null,sessions,report,decisions,failureAnalysis,remediationHints};
}

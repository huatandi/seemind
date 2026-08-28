import {runMultiPassOcr} from './multi-pass-ocr.js';

export async function runOcrEnsemble({
  candidates,
  engines,
  language='auto',
  onProgress,
  maxEngines=2,
  maxPassesPerEngine=3,
  maxTotalRecognitions=6,
  earlyStopScore=null,
  performanceStore=null,
  totalBudgetMs=null,
  perRecognitionTimeoutMs=null,
  signal=null,
}={}){
  if(!Array.isArray(engines)||!engines.length)throw new Error('OCR_ENGINES_REQUIRED');
  const selectedEngines=engines.slice(0,Math.max(1,Math.min(4,maxEngines)));
  const results=[];
  let used=0;
  const deadlineAt=Number.isFinite(Number(totalBudgetMs))&&Number(totalBudgetMs)>0?Date.now()+Number(totalBudgetMs):null;
  for(let e=0;e<selectedEngines.length;e++){
    if(signal?.aborted){const x=new Error('OCR_ABORTED');x.code='OCR_ABORTED';throw x}
    if(deadlineAt!=null&&Date.now()>=deadlineAt){onProgress?.({status:'budget-exhausted',reason:'OCR_TOTAL_BUDGET'});break}
    const engine=selectedEngines[e];
    const remaining=maxTotalRecognitions-used;
    if(remaining<=0)break;
    const passes=Math.min(maxPassesPerEngine,remaining);
    const started=Date.now();
    try{
      const run=await runMultiPassOcr({
        candidates,ocrEngine:engine,language,maxPasses:passes,earlyStopScore,deadlineAt,perRecognitionTimeoutMs,signal,
        onProgress:m=>onProgress?.({...m,engineId:engine.id,engineIndex:e+1,engineCount:selectedEngines.length}),
      });
      const latencyMs=Date.now()-started;
      used+=run.passes.length;
      results.push({engine,run,status:'ok',latencyMs});
      performanceStore?.recordSuccess?.(engine.id,{latencyMs,score:run.selected.scoring.score});
      if(earlyStopScore!=null&&Number.isFinite(Number(earlyStopScore))&&run.selected.scoring.score>=Number(earlyStopScore)){
        onProgress?.({status:'early-stop',engineId:engine.id,score:run.selected.scoring.score,threshold:Number(earlyStopScore)});
        break;
      }
    }catch(error){
      if(error?.code==='OCR_ABORTED'||signal?.aborted){const x=error?.code==='OCR_ABORTED'?error:new Error('OCR_ABORTED');x.code='OCR_ABORTED';throw x}
      // A single OCR engine must not break Student vision. Record a safe failure
      // and continue to the next registered engine.
      used+=1;
      const latencyMs=Date.now()-started;
      results.push({engine,run:null,status:'failed',errorCode:safeErrorCode(error),latencyMs});
      performanceStore?.recordFailure?.(engine.id,{latencyMs,errorCode:safeErrorCode(error)});
      onProgress?.({status:'engine-failed',engineId:engine.id,errorCode:safeErrorCode(error)});
    }
  }
  const successful=results.filter(x=>x.status==='ok'&&x.run);
  if(!successful.length){
    const e=new Error('ALL_OCR_ENGINES_FAILED');e.code='ALL_OCR_ENGINES_FAILED';
    e.failures=results.map(x=>({engineId:x.engine.id,errorCode:x.errorCode??'OCR_ENGINE_FAILED'}));
    throw e;
  }
  const ranked=successful.map(({engine,run})=>({
    engineId:engine.id,
    engineVersion:engine.version??'unknown',
    providerType:engine.providerType??'local',
    planId:run.selectedPlanId,
    selectedPass:run.selectedPass,
    score:run.selected.scoring.score,
    ocrConfidence:run.selected.scoring.ocrConfidence,
    run,
  })).sort((a,b)=>b.score-a.score||b.ocrConfidence-a.ocrConfidence||enginePriority(results,b.engineId)-enginePriority(results,a.engineId));

  const selected=ranked[0];
  return {
    schemaVersion:1,
    selectedEngineId:selected.engineId,
    selectedEngineVersion:selected.engineVersion,
    selectedPlanId:selected.planId,
    selectedPass:selected.selectedPass,
    totalRecognitions:used,
    stageTimings:sumStageTimings(successful.map(x=>x.run.stageTimings)),
    selected:selected.run.selected,
    engines:[
      ...ranked.map(x=>({
        engineId:x.engineId,engineVersion:x.engineVersion,providerType:x.providerType,
        status:'ok',selectedPlanId:x.planId,selectedPass:x.selectedPass,score:x.score,ocrConfidence:x.ocrConfidence,
        latencyMs:results.find(r=>r.engine.id===x.engineId)?.latencyMs??null,
        passes:x.run.passes,
      })),
      ...results.filter(x=>x.status==='failed').map(x=>({
        engineId:x.engine.id,engineVersion:x.engine.version??'unknown',providerType:x.engine.providerType??'local',
        status:'failed',errorCode:x.errorCode??'OCR_ENGINE_FAILED',latencyMs:x.latencyMs??null,
      }))
    ],
  };
}
function safeErrorCode(error){
  const code=String(error?.code??error?.message??'OCR_ENGINE_FAILED');
  return /^[A-Z0-9_:-]{3,80}$/.test(code)?code:'OCR_ENGINE_FAILED';
}
function enginePriority(results,id){return results.find(x=>x.engine.id===id)?.engine?.priority??0}

function sumStageTimings(items){const out={};for(const item of items)for(const [k,v] of Object.entries(item??{})){const n=Number(v);if(Number.isFinite(n)&&n>=0)out[k]=Math.round(((out[k]??0)+n)*100)/100}return out}

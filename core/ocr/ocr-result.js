export function normalizeOcrResult(result={},engine={}){
  const text=String(result.text??'');
  const confidence=clamp01(result.confidence);
  return {
    schemaVersion:1,
    engineId:String(result.engineId??engine.id??'unknown'),
    engineVersion:String(result.engineVersion??engine.version??'unknown'),
    providerType:String(result.providerType??engine.providerType??'local'),
    text,
    confidence,
    blocks:normalizeBlocks(result.blocks??[]),
    languages:[...(result.languages??engine.languages??[])].map(String),
    capabilities:{...(engine.capabilities??{}),...(result.capabilities??{})},
    timing:result.timing&&typeof result.timing==='object'?{
      elapsedMs:finiteOrNull(result.timing.elapsedMs),
    }:null,
    diagnostics:safeDiagnostics(result.diagnostics),
  };
}

export function assertOcrResult(result){
  if(!result||typeof result!=='object')throw new Error('OCR_RESULT_REQUIRED');
  if(typeof result.engineId!=='string'||!result.engineId)throw new Error('OCR_RESULT_ENGINE_ID_REQUIRED');
  if(typeof result.text!=='string')throw new Error('OCR_RESULT_TEXT_REQUIRED');
  if(!Number.isFinite(Number(result.confidence)))throw new Error('OCR_RESULT_CONFIDENCE_REQUIRED');
  if(Number(result.confidence)<0||Number(result.confidence)>1)throw new Error('OCR_RESULT_CONFIDENCE_RANGE');
  if(!Array.isArray(result.blocks))throw new Error('OCR_RESULT_BLOCKS_REQUIRED');
  return result;
}

function normalizeBlocks(blocks){
  return Array.isArray(blocks)?blocks.slice(0,2000).map((b,i)=>({
    id:String(b?.id??`block-${i+1}`),
    text:String(b?.text??''),
    confidence:clamp01(b?.confidence),
    bbox:normalizeBbox(b?.bbox),
    lineIndex:Number.isFinite(Number(b?.lineIndex))?Number(b.lineIndex):null,
  })):[];
}
function normalizeBbox(b){
  if(!b)return null;
  if(Array.isArray(b)&&b.length===4)return b.map(Number);
  if(typeof b==='object')return {x:num(b.x),y:num(b.y),width:num(b.width),height:num(b.height)};
  return null;
}
function safeDiagnostics(d){
  if(!d||typeof d!=='object')return {};
  const allowed=['orientation','script','pageCount','warning','mode','languageHint','trainedLanguage','workerCacheHit','workerCreated','workerInitShared','hotWorkerCountBefore','hotWorkerCountAfter','retiringWorkerCount','workerReservationCount','maxConcurrentWorkerInits','effectiveWorkerInitConcurrency','workerInitTimingMs','workerInitTimingJitterMs','estimatedWorkerInitMs','workerInitTimingSamples','languageWorkerInitTimingMs','languageWorkerInitTimingJitterMs','languageWorkerInitTimingSamples','maxWorkerInitWaiters','activeWorkerInits','workerInitWaiterCount','maxQueueDepth','adaptiveQueueDepth','burstRetentionBudgetMs','queueDepth','estimatedWarmRecognitionMs','recognitionTimingSamples','recognitionTimingJitterMs'];
  const safe=Object.fromEntries(allowed.filter(k=>d[k]!=null).map(k=>[k,d[k]]));
  if(d.timing&&typeof d.timing==='object'){
    safe.timing=Object.fromEntries(['runtimeWaitMs','workerInitThrottleWaitMs','workerInitWaitMs','queueWaitMs','recognitionMs','totalMs']
      .map(key=>[key,finiteOrNull(d.timing[key])]).filter(([,value])=>value!=null&&value>=0));
  }
  return safe;
}
function clamp01(n){n=Number(n);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
function finiteOrNull(n){n=Number(n);return Number.isFinite(n)?n:null}
function num(n){n=Number(n);return Number.isFinite(n)?n:0}

import {normalizeOcrText} from './ocr-normalizer.js';
import {parseReceiptText} from '../../features/receipt/receipt-parser.js';
import {withDeadline} from '../performance/timeout.js';

export async function runMultiPassOcr({candidates,ocrEngine,language='auto',locale=null,onProgress,maxPasses=3,earlyStopScore=null,deadlineAt=null,perRecognitionTimeoutMs=null,signal=null}={}){
  if(!Array.isArray(candidates)||!candidates.length)throw new Error('OCR_CANDIDATES_REQUIRED');
  if(!ocrEngine?.recognize)throw new Error('OCR_ENGINE_REQUIRED');
  throwIfAborted(signal);
  const bounded=candidates.slice(0,Math.max(1,Math.min(4,maxPasses)));
  const passes=[];
  const stageTimings={materialize:0,recognition:0,postprocess:0};
  for(let i=0;i<bounded.length;i++){
    throwIfAborted(signal);
    const candidate=bounded[i];
    // Check the user-visible budget before doing any potentially expensive image
    // materialization/PNG encoding. An exhausted route must not spend more CPU just
    // to discover that recognition itself is no longer allowed to start.
    const remainingBeforeMaterialize=deadlineAt==null?null:Number(deadlineAt)-Date.now();
    if(remainingBeforeMaterialize!=null&&remainingBeforeMaterialize<=0){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
    const materialization=ocrEngine.providerType==='gateway'||ocrEngine.providerType==='remote'
      ?materializeBlob(candidate)
      :(candidate.ocrInput!=null?Promise.resolve(candidate.ocrInput):materializeBlob(candidate));
    const materializeStarted=nowMs();
    const image=remainingBeforeMaterialize==null
      ?await materialization
      :await withDeadline(materialization,Math.max(1,remainingBeforeMaterialize),'OCR_IMAGE_PREPARATION_BUDGET_TIMEOUT',{signal,abortCode:'OCR_ABORTED'});
    stageTimings.materialize+=nowMs()-materializeStarted;
    const remaining=deadlineAt==null?null:Number(deadlineAt)-Date.now();
    if(remaining!=null&&remaining<=0){const e=new Error('OCR_BUDGET_EXHAUSTED');e.code='OCR_BUDGET_EXHAUSTED';throw e}
    const timeoutCandidates=[remaining,Number(perRecognitionTimeoutMs)].filter(x=>Number.isFinite(x)&&x>0);
    const recognitionTimeoutMs=timeoutCandidates.length?Math.max(1,Math.min(...timeoutCandidates)):null;
    const recognition=ocrEngine.recognize(image,{
      language,deadlineAt,timeoutMs:recognitionTimeoutMs,signal,
      onProgress:m=>onProgress?.({...m,pass:i+1,passes:bounded.length,planId:candidate.planId??candidate.selectedPlan?.id})
    });
    const recognitionStarted=nowMs();
    const ocr=timeoutCandidates.length?await withDeadline(recognition,Math.max(1,Math.min(...timeoutCandidates)),'OCR_RECOGNITION_BUDGET_TIMEOUT',{signal,abortCode:'OCR_ABORTED'}):await recognition;
    stageTimings.recognition+=nowMs()-recognitionStarted;
    const postprocessStarted=nowMs();
    const normalization=normalizeOcrText(ocr.text,{locale});
    const receipt=parseReceiptText(normalization.normalizedText);
    const scoring=scoreReceiptOcrPass({ocr,normalization,receipt});
    stageTimings.postprocess+=nowMs()-postprocessStarted;
    passes.push({
      pass:i+1,
      planId:candidate.planId??candidate.selectedPlan?.id??`candidate-${i+1}`,
      ocr,normalization,receipt,scoring,
    });
    // A strong first candidate should become the answer immediately. Running
    // extra preprocessing variants after the evidence is already sufficient
    // only burns CPU/battery and increases time-to-result on mobile devices.
    if(earlyStopScore!=null&&Number.isFinite(Number(earlyStopScore))&&scoring.score>=Number(earlyStopScore)){
      onProgress?.({status:'pass-early-stop',pass:i+1,score:scoring.score,threshold:Number(earlyStopScore)});
      break;
    }
  }
  passes.sort((a,b)=>b.scoring.score-a.scoring.score||b.scoring.ocrConfidence-a.scoring.ocrConfidence||a.pass-b.pass);
  const selected=passes[0];
  return {
    schemaVersion:1,
    selectedPlanId:selected.planId,
    selectedPass:selected.pass,
    selected,
    stageTimings:Object.fromEntries(Object.entries(stageTimings).map(([k,v])=>[k,roundMs(v)])),
    passes:passes.map(p=>({
      pass:p.pass,planId:p.planId,scoring:p.scoring,
      ocr:{engineId:p.ocr.engineId,confidence:p.ocr.confidence},
      normalization:{changed:p.normalization.changed,confidence:p.normalization.confidence,transformationCount:p.normalization.transformations.length},
      receiptSummary:summarizeReceipt(p.receipt),
    })),
  };
}

export function scoreReceiptOcrPass({ocr={},normalization={},receipt={}}={}){
  const fields=['merchant','date','subtotal','tax','discount','total','cash','change'];
  const resolved=fields.filter(k=>receipt?.[k]?.value!=null);
  const critical=['date','total'].filter(k=>receipt?.[k]?.value!=null);
  const supported=(receipt.checks??[]).filter(x=>x.status==='supported').length;
  const conflicted=(receipt.checks??[]).filter(x=>x.status==='conflicted').length;
  const ocrConfidence=clamp01(ocr.confidence);
  const normalizationConfidence=clamp01(normalization.confidence??1);
  const fieldCompleteness=resolved.length/fields.length;
  const criticalCompleteness=critical.length/2;
  const arithmetic=Math.max(0,Math.min(1,.5+supported*.25-conflicted*.45));
  const recoveryPenalty=Math.min(.16,(normalization.transformations?.length??0)*.015);
  const score=round100(
    ocrConfidence*.25+
    fieldCompleteness*.20+
    criticalCompleteness*.25+
    arithmetic*.20+
    normalizationConfidence*.10-
    recoveryPenalty
  );
  return {
    score,
    ocrConfidence,
    normalizationConfidence,
    fieldCompleteness:round(fieldCompleteness),
    criticalCompleteness:round(criticalCompleteness),
    arithmeticConsistency:round(arithmetic),
    supportedChecks:supported,
    conflictedChecks:conflicted,
    normalizationTransformations:normalization.transformations?.length??0,
    reasons:buildReasons({critical,supported,conflicted,resolved,ocrConfidence}),
  };
}

function summarizeReceipt(r={}){
  return Object.fromEntries(['merchant','date','subtotal','tax','discount','total','cash','change'].map(k=>[k,r?.[k]?.value??null]));
}
function buildReasons({critical,supported,conflicted,resolved,ocrConfidence}){
  const out=[`resolved_fields:${resolved.length}`,`critical_fields:${critical.length}`,`ocr_confidence:${round(ocrConfidence)}`];
  if(supported)out.push(`supported_arithmetic:${supported}`);
  if(conflicted)out.push(`conflicted_arithmetic:${conflicted}`);
  return out;
}
function clamp01(n){n=Number(n);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
function round(n,d=3){const p=10**d;return Math.round(n*p)/p}
function round100(n){return Math.round(Math.max(0,Math.min(1,n))*100)}

async function materializeBlob(candidate){
  if(typeof candidate?.getBlob==='function')return candidate.getBlob();
  const value=await candidate?.blob;
  if(value)return value;
  throw new Error('OCR_CANDIDATE_IMAGE_REQUIRED');
}

function throwIfAborted(signal){if(signal?.aborted){const e=new Error('OCR_ABORTED');e.code='OCR_ABORTED';throw e}}

function nowMs(){return globalThis.performance?.now?.()??Date.now()}
function roundMs(n){return Math.round(Number(n)*100)/100}

/**
 * Quality gate between sensors/perception and reasoning.
 * Low-quality observations are not promoted into facts merely because an engine returned output.
 */
export function assessPerceptionQuality({modality,confidence=null,agreement=null,quality={},critical=false,alternatives=[]}={}){
  const c=clamp(confidence??.5),a=clamp(agreement??c);
  const q=modality==='image'?imageQuality(quality):modality==='voice'?voiceQuality(quality):modality==='ocr'?ocrQuality(quality):.7;
  const score=.5*c+.25*a+.25*q;
  const threshold=critical?.84:.68;
  const contradictions=alternatives.filter(x=>x?.value!=null&&x.value!==alternatives[0]?.value&&Number(x.confidence??0)>=.65).length;
  let disposition='ACCEPT_AS_OBSERVATION',reason='QUALITY_SUFFICIENT';
  if(contradictions){disposition='RECOVER_OR_ESCALATE';reason='COMPETING_HIGH_CONFIDENCE_CANDIDATES'}
  else if(score<threshold){disposition=score<.48?'REACQUIRE_INPUT':'RECOVER_OR_ESCALATE';reason='PERCEPTION_QUALITY_BELOW_THRESHOLD'}
  return {schemaVersion:1,modality,score,threshold,confidence:c,agreement:a,sensorQuality:q,critical:Boolean(critical),
    disposition,reason,promoteToVerifiedFact:false,needsRecovery:disposition!=='ACCEPT_AS_OBSERVATION'};
}
export function planPerceptionRecovery(gate,{offline=true,available=[]}={}){
  if(!gate?.needsRecovery)return {action:'NONE',steps:[]};
  const steps=[];
  if(gate.disposition==='REACQUIRE_INPUT')steps.push(gate.modality==='voice'?'ASK_REPEAT_OR_RELISTEN':'RECAPTURE_OR_REFRAME');
  if(gate.modality==='ocr')steps.push('ALTERNATE_PREPROCESSING','SECOND_OCR_PASS');
  if(gate.modality==='image')steps.push('LOCAL_VISION_RECHECK');
  if(gate.modality==='voice')steps.push('LOCAL_ASR_RECHECK');
  if(!offline&&available.includes('teacher'))steps.push('TEACHER_PERCEPTION_RESCUE');
  const unique=[...new Set(steps)];
  // Keep recovery bounded while reserving the last slot for an explicitly allowed Teacher rescue.
  const teacher=unique.includes('TEACHER_PERCEPTION_RESCUE');
  const bounded=teacher?[...unique.filter(x=>x!=='TEACHER_PERCEPTION_RESCUE').slice(0,2),'TEACHER_PERCEPTION_RESCUE']:unique.slice(0,3);
  return {action:'RECOVER',steps:bounded,preserveOriginalObservation:true};
}
function imageQuality(q){return avg([q.sharpness,q.exposure,q.subjectCoverage,q.motionStability],.65)}
function voiceQuality(q){return avg([q.signalToNoise,q.completeness,q.noClipping],.65)}
function ocrQuality(q){return avg([q.textClarity,q.layoutStability,q.characterSeparation],.65)}
function avg(xs,f){const a=xs.filter(x=>x!=null).map(clamp);return a.length?a.reduce((s,x)=>s+x,0)/a.length:f}
function clamp(v){return Math.max(0,Math.min(1,Number(v)||0))}

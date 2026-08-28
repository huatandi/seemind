/**
 * Chooses the smallest useful recovery operation for the observed failure.
 * Recovery targets the disputed region/field; it does not blindly rerun the whole pipeline.
 */
export function diagnosePerceptionFailure({modality,fieldType=null,candidates=[],context={},quality={}}={}){
  const values=[...new Set(candidates.map(x=>String(x?.value??'')).filter(Boolean))];
  const confusable=values.length>1&&looksConfusable(values);
  if(modality==='ocr'&&fieldType==='money'&&confusable)return {kind:'OCR_SYMBOL_OR_DIGIT_CONFUSION',target:'FIELD_REGION',semanticChecks:['MONEY_FORMAT','ARITHMETIC_CONSISTENCY','PAYMENT_CHANGE_CONSISTENCY']};
  if(modality==='ocr'&&['model','sku','serial'].includes(fieldType))return {kind:'OCR_IDENTITY_TOKEN_UNCERTAIN',target:'TOKEN_REGION',semanticChecks:['BARCODE_IDENTITY','PACKAGING_AGREEMENT']};
  if(modality==='voice'&&candidates.length>1)return {kind:'VOICE_TOKEN_AMBIGUITY',target:'AMBIGUOUS_SPAN',semanticChecks:['VISUAL_CONTEXT','OCR_CONTEXT','DIALOGUE_CONTEXT']};
  if(modality==='image'&&(quality.sharpness??1)<.55)return {kind:'IMAGE_BLUR',target:'SUBJECT_REGION',semanticChecks:[]};
  return {kind:'GENERIC_LOW_CONFIDENCE',target:'LOCAL_REGION',semanticChecks:[]};
}
export function planAdaptiveRecovery(diagnosis,{offline=true,teacherAllowed=false}={}){
  const map={
    OCR_SYMBOL_OR_DIGIT_CONFUSION:['CROP_FIELD','CONTRAST_VARIANTS','LOCAL_OCR_RECHECK','SEMANTIC_CONSISTENCY_CHECK'],
    OCR_IDENTITY_TOKEN_UNCERTAIN:['CROP_TOKEN','LOCAL_OCR_RECHECK','BARCODE_OR_VISION_CROSSCHECK'],
    VOICE_TOKEN_AMBIGUITY:['RECHECK_AMBIGUOUS_AUDIO_SPAN','CROSS_MODAL_CONTEXT_CHECK'],
    IMAGE_BLUR:['RECAPTURE_SUBJECT','LOCAL_VISION_RECHECK'],
    GENERIC_LOW_CONFIDENCE:['LOCAL_TARGETED_RECHECK']
  };
  const steps=[...(map[diagnosis?.kind]??map.GENERIC_LOW_CONFIDENCE)];
  if(!offline&&teacherAllowed)steps.push('TEACHER_TARGETED_RESCUE');
  return {strategy:'TARGETED_RECOVERY',target:diagnosis?.target??'LOCAL_REGION',steps:steps.slice(0,4),rerunWholePipeline:false,preserveOriginal:true};
}
export function crossModalVerify({claim,ocr=[],vision=[],voice=[],barcode=[],arithmetic=[]}={}){
  const sources={ocr,vision,voice,barcode,arithmetic};let support=0,oppose=0,independent=0;
  for(const [source,items] of Object.entries(sources)){const matches=items.filter(x=>String(x?.value)===String(claim)&&Number(x?.confidence??1)>=.6);const conflicts=items.filter(x=>x?.value!=null&&String(x.value)!==String(claim)&&Number(x?.confidence??0)>=.7);if(matches.length){support+=Math.max(...matches.map(x=>Number(x.confidence??1)));independent++}if(conflicts.length)oppose+=Math.max(...conflicts.map(x=>Number(x.confidence??0)))}
  const verified=independent>=2&&support-oppose>=1.2;
  return {claim,verified,independentSupportingModalities:independent,supportScore:support,oppositionScore:oppose,disposition:verified?'CROSS_MODAL_SUPPORTED':oppose>support?'CONFLICT':'INSUFFICIENT_SUPPORT'};
}
function looksConfusable(values){if(values.length<2)return false;const a=values[0],b=values[1];if(a.length!==b.length)return true;let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;return diff<=2}

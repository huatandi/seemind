import {assessPerceptionQuality,planPerceptionRecovery} from './perception-quality-gate.js';
import {diagnosePerceptionFailure,planAdaptiveRecovery} from './adaptive-perception-recovery.js';

/**
 * One boundary from sensor/model output into reasoning.
 * OCR, vision and voice may produce observations/candidates; none may declare truth here.
 */
export function normalizePerceptionObservation(input={}){
  const modality=normalizeModality(input.modality);
  const gate=assessPerceptionQuality({
    modality,confidence:input.confidence,agreement:input.agreement,quality:input.quality??{},
    critical:Boolean(input.critical),alternatives:input.alternatives??[]
  });
  const diagnosis=gate.needsRecovery?diagnosePerceptionFailure({
    modality,fieldType:input.fieldType??null,candidates:input.alternatives??[],context:input.context??{},quality:input.quality??{}
  }):null;
  return {
    schemaVersion:1,kind:'perception_observation',modality,value:input.value??null,
    confidence:gate.confidence,quality:gate,diagnosis,
    epistemicStatus:gate.needsRecovery?'UNCERTAIN_OBSERVATION':'OBSERVATION',
    verified:false,source:input.source??modality,provenance:input.provenance??null
  };
}
export function decidePerceptionRecovery(observation,{offline=true,teacherAllowed=false}={}){
  if(!observation?.quality?.needsRecovery)return {action:'NONE',steps:[],rerunWholePipeline:false};
  if(observation.diagnosis){
    return planAdaptiveRecovery(observation.diagnosis,{offline,teacherAllowed});
  }
  return {...planPerceptionRecovery(observation.quality,{offline,available:teacherAllowed?['teacher']:[]}),rerunWholePipeline:false};
}
export function perceptionCanBecomeFact(observation){
  // Perception quality is necessary for reasoning, never sufficient for fact verification.
  return {allowed:false,reason:'EVIDENCE_VERIFICATION_REQUIRED',observation};
}
function normalizeModality(x){const s=String(x??'').toLowerCase();return s==='vision'?'image':s==='asr'?'voice':s||'unknown'}

import {normalizePerceptionObservation,decidePerceptionRecovery} from '../../../../core/perception/perception-boundary.js';
import {assessPlanningNeed} from '../../../../core/orchestration/intelligent-planning-escalation.js';
import {composeSpecialistJobs} from '../../../../core/orchestration/multi-specialist-composition.js';
import {assessProblemResolution} from '../../../../core/resolution/problem-resolution-state.js';

/**
 * Runtime convergence facade. Recent architecture modules enter production through
 * one bounded adapter instead of being imported ad-hoc by the web shell.
 */
export function assessRuntimePerception(observation={}){
  const modality=observation.detectedType==='receipt'||observation.detectedType==='receipt_candidate'?'ocr':'image';
  const confidence=Number(observation.confidence?.fact??observation.confidence?.overall??0);
  const prep=(observation.observations??[]).find(x=>x.kind==='preprocessing')??{};
  const quality=modality==='ocr'
    ?{textClarity:Number(prep.quality?.sharpness??confidence),layoutStability:confidence,characterSeparation:confidence}
    :{sharpness:Number(prep.quality?.sharpness??confidence),exposure:Number(prep.quality?.exposure??confidence),subjectCoverage:confidence,motionStability:confidence};
  const normalized=normalizePerceptionObservation({modality,confidence,agreement:confidence,quality,critical:modality==='ocr',source:'runtime'});
  if(!normalized.quality.needsRecovery)return {gate:normalized.quality,recovery:null,adaptive:null,observation:normalized};
  const decision=decidePerceptionRecovery(normalized,{offline:true,teacherAllowed:false});
  return {gate:normalized.quality,recovery:decision,adaptive:normalized.diagnosis?decision:null,observation:normalized};
}

export function convergeProblemRuntime({task={},universal={},brain={},verifiedEvidence=[],specialistJobs=[]}={}){
  const composition=composeSpecialistJobs({task,student:{exactIdentity:universal?.multimodal?.activeEntity?.label??null},residuals:brain?.answerability?.unknowns??[]});
  const planning=assessPlanningNeed({task,studentPlan:composition,residuals:brain?.answerability?.unknowns??[],confidence:brain?.answerability?.confidence??null});
  const subgoals=composition.jobs.length?composition.jobs.map(j=>({id:j.id,text:j.kind})): [{id:'goal',text:task.userIntent??task.type??'resolve user goal'}];
  const resolution=assessProblemResolution({goal:task.userIntent,subgoals,verifiedEvidence,specialistJobs});
  return {schemaVersion:1,planning,composition,resolution,sourceOfTruth:'PROBLEM_SESSION',brainStateRole:'DERIVED_WORKING_VIEW'};
}

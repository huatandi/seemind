import {planNextBestVisualEvidence} from '../vision/next-best-visual-evidence.js';
import {planVisionFailureRecovery} from '../vision/vision-failure-recovery.js';
export function planResolution({observation={},problem={},context={}}={}){
  const intent=problem?.intentHypotheses?.[0]?.intent??'identify_and_explain';
  const overall=Number(observation.confidence?.overall??0);
  const hasConflicts=(problem.problemSignals??[]).some(x=>x.kind==='conflicting_evidence');
  const limitations=observation.limitations??[];
  const localCapable=Boolean(observation.localResolutionPossible);
  const requestedSolution=['troubleshoot','solve_or_guide'].includes(intent);
  const unknownType=(problem.detectedType??'unknown')==='unknown';
  const visualPlan=context.visualPlan??context.multimodalContext?.visualPlan??findObservation(observation,'visual_capability_plan')??null;
  const missingVisual=visualPlan?.route?.missingCapabilities??visualPlan?.missingCapabilities??[];
  const needsVisionTeacher=Boolean(visualPlan?.route?.needsVisionTeacher??visualPlan?.needsVisionTeacher);
  const activeVision=planNextBestVisualEvidence({missingCapabilities:missingVisual,observation,problem});
  const quality=observation?.imageQuality??findObservation(observation,'image_quality')?.quality??findObservation(observation,'image_quality')??{};
  const recovery=planVisionFailureRecovery({
    quality,
    missingCapabilities:missingVisual,
    deviceProfile:context.deviceProfile??observation?.deviceProfile??{},
    attempts:Number(context.visualRecoveryAttempts??observation?.visualRecoveryAttempts??0),
    userCanRecapture:context.userCanRecapture!==false,
  });

  let decision='local_explain';
  const reasons=[];
  if(hasConflicts){decision='need_more_evidence';reasons.push('conflicting_evidence')}
  else if(recovery.shouldEscalate){decision='teacher_or_tool';reasons.push('bounded_visual_recovery_exhausted')}
  else if(activeVision.needed){decision='need_more_evidence';reasons.push('actionable_visual_evidence_gap')}
  else if(recovery.needed){decision='need_more_evidence';reasons.push('recoverable_visual_failure')}
  else if(unknownType&&overall<.55){decision='need_more_evidence';reasons.push('identity_uncertain')}
  else if(needsVisionTeacher&&missingVisual.length){decision='teacher_or_tool';reasons.push('missing_visual_capabilities')}
  else if(requestedSolution&&!localCapable){decision='teacher_or_tool';reasons.push('solution_requires_more_than_current_local_evidence')}
  else if(!localCapable&&limitations.length){decision='teacher_or_tool';reasons.push('local_limitations')}
  else reasons.push('local_evidence_sufficient');

  const recoveryRequests=recovery.actions.filter(x=>x.type==='RECAPTURE').map((x,i)=>({kind:'capture_guidance',priority:i+1,target:'quality_recovery',instruction:x.instruction,reason:recovery.reasons.join(','),evidencePolicy:'improve_capture_before_heavy_escalation'}));
  const nextEvidence=recoveryRequests.length?recoveryRequests:(activeVision.needed?activeVision.requests:buildEvidenceRequests(problem,decision));
  const escalation=buildEscalation({decision,intent,detectedType:problem.detectedType,context:{...context,missingVisual,needsVisionTeacher}});
  return {
    schemaVersion:1,
    decision,
    canExplainNow:overall>=.35 || (problem.knownFacts?.length??0)>0,
    canOfferSolutionNow:localCapable&&!hasConflicts,
    reasons,
    nextEvidence,
    evidenceGap:activeVision.needed?{
      kind:'visual',
      capabilities:activeVision.gapCapabilities,
      nextBestTarget:activeVision.requests[0]?.target??null,
      policy:'COLLECT_CHEAP_DECISIVE_EVIDENCE_BEFORE_ESCALATION',
    }:null,
    visualRecovery:recovery,
    escalation,
    principle:'Never end at I do not know; state known facts, uncertainty, and the best next step.',
  };
}

function buildEvidenceRequests(problem,decision){
  if(decision!=='need_more_evidence')return [];
  const type=problem.detectedType;
  if(type==='unknown')return [
    {kind:'capture_guidance',priority:1,instruction:'拍一张包含完整物体和周围环境的照片，不要只拍局部。',reason:'Need object + scene context.'},
    {kind:'capture_guidance',priority:2,instruction:'如果物体有铭牌、型号、标签、错误代码或接口，请再拍一张清晰近照。',reason:'Labels and model/error codes often identify the object or problem.'},
  ];
  return [{kind:'clarification',priority:1,instruction:'补充一张最能显示异常位置、标签或错误信息的近照。',reason:'Current evidence is conflicting or incomplete.'}];
}
function buildEscalation({decision,intent,detectedType,context}){
  if(decision==='local_explain')return {needed:false};
  const requested=[];
  if(intent==='troubleshoot'||intent==='solve_or_guide')requested.push('reasoning','troubleshooting');
  if(detectedType==='unknown'||context.needsVisionTeacher)requested.push('vision');
  if(context.freshnessRequired)requested.push('web_search');
  return {
    needed:true,
    preferredKinds:requested.length?requested:['reasoning'],
    sendPolicy:'minimum_necessary',
    sendOriginalImage:Boolean(detectedType==='unknown'),
    sendStructuredFacts:true,
    reason:decision==='need_more_evidence'?'Escalate only after useful evidence collection when possible.':'Local Student cannot reliably complete the requested solution.',
  };
}

export function recommendHelpPath({problem={},resolution={},availableTeachers=[]}={}){
  if(!resolution?.escalation?.needed)return {kind:'local',message:'Student can continue locally.'};
  if(availableTeachers.length)return {kind:'teacher',message:'Use the best capable Teacher for the unresolved subproblem.',candidates:availableTeachers};
  const intent=problem.intentHypotheses?.[0]?.intent;
  if(intent==='troubleshoot')return {kind:'human_or_specialist_tool',message:'If AI cannot verify the cause, use the relevant manufacturer manual, diagnostic tool, or qualified technician.'};
  return {kind:'search_or_specialist',message:'Use a specialist model/tool, authoritative database/manual, web search, or a qualified human expert for the unresolved part.'};
}

function findObservation(o,kind){return (o?.observations??[]).find(x=>x.kind===kind)}

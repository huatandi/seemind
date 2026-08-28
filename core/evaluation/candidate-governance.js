import {transitionCandidate,canPromoteCandidate} from './improvement-candidate.js';

export function recordOfflineEvaluation(candidate,report={}){
  requireStage(candidate,'proposed');
  const normalized=normalizeReport(report);
  if(!Number.isFinite(normalized.baselineScore)||!Number.isFinite(normalized.candidateScore))throw new Error('OFFLINE_EVALUATION_SCORES_REQUIRED');
  const next=transitionCandidate(candidate,'offline_evaluated',{note:`baseline=${normalized.baselineScore}; candidate=${normalized.candidateScore}`});
  return {...next,offlineEvaluation:normalized};
}

export function recordGoldenRegressionResult(candidate,{baseline,candidateReport,comparison}={}){
  requireStage(candidate,'offline_evaluated');
  if(!baseline||!candidateReport||!comparison)throw new Error('GOLDEN_REGRESSION_REPORT_REQUIRED');
  const report={
    passed:Boolean(comparison.passed),
    total:Number(candidateReport.caseCount??0),
    failed:Number(comparison.regressions?.length??0),
    criticalRegressions:[...(comparison.criticalRegressions??[])],
    reportId:candidateReport.reportId??null,
  };
  return recordRegressionResult(candidate,report);
}

export function recordRegressionResult(candidate,report={}){
  requireStage(candidate,'offline_evaluated');
  const normalized={passed:Boolean(report.passed),total:Number(report.total??0),failed:Number(report.failed??0),criticalRegressions:[...(report.criticalRegressions??[])].map(String).slice(0,50),reportId:report.reportId??null};
  if(!normalized.passed||normalized.failed>0||normalized.criticalRegressions.length){return transitionCandidate(candidate,'rejected',{note:'Regression gate failed; production promotion blocked.'})}
  const next=transitionCandidate(candidate,'regression_passed',{note:`Regression passed (${normalized.total} cases).`});
  return {...next,regression:normalized};
}

export function approveCandidate(candidate,{approved=false,reviewer='user',note=''}={}){
  requireStage(candidate,'regression_passed');
  if(!approved)throw new Error('EXPLICIT_APPROVAL_REQUIRED');
  return transitionCandidate(candidate,'approved',{approval:true,note:`Approved by ${String(reviewer).slice(0,80)}. ${String(note).slice(0,180)}`.trim()});
}

export function promoteCandidate(candidate,{releaseId=null,note=''}={}){
  const gate=canPromoteCandidate(candidate);if(!gate.ok)throw new Error(gate.reason);
  const next=transitionCandidate(candidate,'promoted',{note:`Promotion recorded${releaseId?` for ${String(releaseId).slice(0,80)}`:''}. ${String(note).slice(0,180)}`.trim()});
  return {...next,promotion:{releaseId:releaseId??null,promotedAt:new Date().toISOString()}};
}

function normalizeReport(r){return {baselineScore:Number(r.baselineScore),candidateScore:Number(r.candidateScore),delta:Number(r.candidateScore)-Number(r.baselineScore),caseCount:Number(r.caseCount??0),criticalFailures:[...(r.criticalFailures??[])].map(String).slice(0,50),reportId:r.reportId??null}}
function requireStage(candidate,stage){if(candidate?.stage!==stage)throw new Error(`CANDIDATE_STAGE_REQUIRED:${stage}`)}

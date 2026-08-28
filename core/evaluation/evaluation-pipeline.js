import {evaluateAuditTrail} from './evaluator.js';
import {createImprovementCandidate} from './improvement-candidate.js';

export function evaluateExecution({audit,executionId=null,taskId=null,createCandidate=true}={}){
  if(!audit?.list)throw new Error('AUDIT_LOG_REQUIRED');
  const events=audit.list({executionId,taskId,limit:1000});
  const evaluation=evaluateAuditTrail(events);
  const candidate=createCandidate?createImprovementCandidate({evaluation}):null;
  audit.record?.('evaluation_completed',{evaluationId:evaluation.evaluationId,executionId:evaluation.executionId,taskId:evaluation.taskId,taskSolved:evaluation.taskSolved,score:evaluation.score,primaryCategory:evaluation.primaryFailure?.category??null,primaryCode:evaluation.primaryFailure?.code??null,recommendation:evaluation.recommendation,candidateId:candidate?.id??null});
  if(candidate)audit.record?.('improvement_candidate_proposed',{candidateId:candidate.id,evaluationId:evaluation.evaluationId,category:candidate.category,target:candidate.target,stage:candidate.stage});
  return {evaluation,candidate};
}

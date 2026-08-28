import {planTask} from './planner.js';
import {runTaskGraph} from './task-graph-runner.js';
import {createExecutionContext,executionSnapshot} from './execution-context.js';
import {NodeHandlerRegistry} from './node-handler-registry.js';
import {createDefaultNodeHandlers} from './default-node-handlers.js';
import {resumeBlockedNode,cancelTaskGraph} from './task-graph.js';
import {createExecutionCheckpoint,restoreExecutionCheckpoint} from '../persistence/execution-checkpoint.js';
import {evaluateExecution} from '../evaluation/evaluation-pipeline.js';
import {assessGoalSatisfaction} from '../evaluation/goal-satisfaction.js';
import {prepareGapDirectedRecovery} from './gap-directed-recovery.js';

export function createPlannerExecution(input={}){
  if(!input.taskPackage?.task)throw new Error('TASK_PACKAGE_REQUIRED');
  const graph=input.graph??planTask(input.taskPackage.task,{budget:input.graphBudget});
  const context=createExecutionContext(input);
  const registry=new NodeHandlerRegistry().registerMany(createDefaultNodeHandlers()).registerMany(input.handlers??{});
  return {schemaVersion:2,id:input.id??graph.id,graph,context,registry,nodeReceipts:{...(input.nodeReceipts??{})},createdAt:input.createdAt??new Date().toISOString()};
}

export async function executePlannerExecution(execution,{onEvent=null,now=()=>Date.now(),stateStore=null}={}){
  if(!execution?.graph||!execution?.context||!execution?.registry)throw new Error('INVALID_PLANNER_EXECUTION');
  const persist=stateStore?async({reason})=>{const checkpoint=createExecutionCheckpoint(execution,{reason});await stateStore.save(execution.id,checkpoint);execution.context.recovery={...(execution.context.recovery??{}),lastCheckpointAt:checkpoint.checkpointedAt};}:null;
  const audit=execution.context.audit?.child?.({executionId:execution.id,taskId:execution.context.taskPackage?.task?.id})??execution.context.audit;
  const emit=event=>{audit?.record?.(`planner_${event.type}`,event);onEvent?.(event)};
  audit?.record?.('execution_started',{executionId:execution.id,taskType:execution.context.taskPackage?.task?.type,graphNodeCount:execution.graph.nodes.length});
  const result=await runTaskGraph(execution.graph,{handlers:execution.registry.toObject(),context:execution.context,onEvent:emit,onCheckpoint:persist,receipts:execution.nodeReceipts,now});
  audit?.record?.('execution_finished',{executionId:execution.id,status:result.status,reason:result.reason??null,warnings:execution.context.warnings.length});
  try{
    const evaluated=evaluateExecution({audit,executionId:execution.id,taskId:execution.context.taskPackage?.task?.id});
    execution.context.evaluation=evaluated.evaluation;execution.context.improvementCandidate=evaluated.candidate;
  }catch(error){audit?.record?.('evaluation_failed',{executionId:execution.id,code:String(error?.message??error).slice(0,160)});}
  const resultValue=execution.context.result??finalGraphOutput(execution.graph);
  const goalSatisfaction=assessGoalSatisfaction({graph:execution.graph,context:execution.context,result:resultValue});
  execution.context.goalSatisfaction=goalSatisfaction;
  audit?.record?.('goal_satisfaction_assessed',{executionId:execution.id,status:goalSatisfaction.status,reason:goalSatisfaction.reason,gaps:goalSatisfaction.gaps});
  if(stateStore&&['completed','cancelled'].includes(execution.graph.state))await stateStore.remove?.(execution.id);
  return {...result,snapshot:executionSnapshot(execution.context),resultValue,goalSatisfaction,evaluation:execution.context.evaluation??null,improvementCandidate:execution.context.improvementCandidate??null,executionId:execution.id};
}

export function resumePlannerExecution(execution,nodeId,{output=null,retry=false}={}){
  resumeBlockedNode(execution.graph,nodeId,{output,retry});
  if(output?.entity)execution.context.verifiedEntity=output.entity;
  if(execution.nodeReceipts?.[nodeId])execution.nodeReceipts[nodeId]={...execution.nodeReceipts[nodeId],status:retry?'retrying':'completed',output,completedAt:new Date().toISOString()};
  execution.context.trace.push(`graph:resumed:${nodeId}`);return execution;
}

export function cancelPlannerExecution(execution,reason='USER_CANCELLED'){
  cancelTaskGraph(execution.graph,reason);execution.context.trace.push(`graph:cancelled:${reason}`);return execution;
}

export function checkpointPlannerExecution(execution,{reason='manual'}={}){return createExecutionCheckpoint(execution,{reason})}

export function recoverPlannerExecutionGaps(execution,{goalSatisfaction=null}={}){
  return prepareGapDirectedRecovery(execution,{goalSatisfaction});
}

export function restorePlannerExecution(checkpoint,runtime={}){
  const restored=restoreExecutionCheckpoint(checkpoint,runtime);
  normalizeRecoveredGraph(restored);
  restored.registry=new NodeHandlerRegistry().registerMany(createDefaultNodeHandlers()).registerMany(runtime.handlers??{});
  restored.context.recovery={...(restored.context.recovery??{}),restored:true,restoredAt:new Date().toISOString()};
  restored.context.trace.push('graph:restored');return restored;
}

function normalizeRecoveredGraph(execution){
  for(const node of execution.graph.nodes){
    const receipt=execution.nodeReceipts?.[node.id];
    if(receipt?.status==='completed'){
      node.state='completed';node.output=receipt.output??node.output??null;node.evidence=[...(receipt.evidence??node.evidence??[])];continue;
    }
    if(node.state==='running')node.state='pending';
  }
  if(execution.graph.state==='running')execution.graph.state='pending';
  execution.graph.stopReason=null;
  execution.graph.updatedAt=new Date().toISOString();
}

function finalGraphOutput(graph){const completed=[...graph.nodes].reverse().find(n=>n.state==='completed'&&n.output!=null);return completed?.output??null;}

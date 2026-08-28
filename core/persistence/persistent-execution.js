import {createExecutionCheckpoint} from './execution-checkpoint.js';
import {restorePlannerExecution} from '../planning/planner-execution-orchestrator.js';

export async function saveExecution(store,execution,{reason='manual'}={}){
  if(!store?.save)throw new Error('TASK_STATE_STORE_REQUIRED');const checkpoint=createExecutionCheckpoint(execution,{reason});await store.save(checkpoint.executionId,checkpoint);return checkpoint;
}
export async function loadExecution(store,executionId,runtime={}){if(!store?.load)throw new Error('TASK_STATE_STORE_REQUIRED');const checkpoint=await store.load(executionId);return checkpoint?restorePlannerExecution(checkpoint,runtime):null}
export async function removeExecution(store,executionId){if(store?.remove)await store.remove(executionId)}

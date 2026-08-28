import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask} from '../core/task/task.js';
import {createPlannerExecution,executePlannerExecution,checkpointPlannerExecution,restorePlannerExecution} from '../core/planning/planner-execution-orchestrator.js';
import {MemoryTaskStateStore} from '../core/persistence/task-state-store.js';
import {createActionProposal} from '../core/action/action-proposal.js';
import {IdempotentActionExecutor} from '../core/action/idempotent-action-executor.js';

function pkg(){const task=createTask({type:'manual_lookup',userIntent:'找设备说明书'});return {schemaVersion:2,task,userIntent:task.userIntent,evidence:[],entities:[],privacy:{},safety:{sensitiveData:false}}}

test('checkpoint never serializes provider runtime or obvious secrets/media',()=>{
  const execution=createPlannerExecution({taskPackage:{...pkg(),media:[{id:'img',dataUrl:'data:image/jpeg;base64,SECRETIMAGE'}]},privacyPolicy:{apiKey:'SECRET',allowImages:true},providers:[{id:'teacher-secret'}]});
  const cp=checkpointPlannerExecution(execution);const text=JSON.stringify(cp);
  assert.equal(text.includes('SECRETIMAGE'),false);assert.equal(text.includes('SECRET'),false);assert.equal(text.includes('teacher-secret'),false);assert.equal(cp.context.taskPackage.recovery.mediaOmitted,true);
});

test('crashed running node restores as pending and can continue',async()=>{
  const execution=createPlannerExecution({taskPackage:pkg(),handlers:{identify_entity:async()=>({output:{model:'X1'}}),retrieve_primary_manual:async()=>({output:{manual:'ok'}}),explain_manual:async({context})=>{context.result={answer:'done'};return {output:context.result}}}});
  const first=execution.graph.nodes[0];first.state='running';execution.graph.state='running';execution.nodeReceipts[first.id]={idempotencyKey:`${execution.graph.id}:${first.id}:attempt-1`,status:'running'};
  const restored=restorePlannerExecution(checkpointPlannerExecution(execution),{handlers:{identify_entity:async()=>({output:{model:'X1'}}),retrieve_primary_manual:async()=>({output:{manual:'ok'}}),explain_manual:async({context})=>{context.result={answer:'done'};return {output:context.result}}}});
  assert.equal(restored.graph.nodes[0].state,'pending');const r=await executePlannerExecution(restored);assert.equal(r.status,'completed');assert.equal(r.resultValue.answer,'done');
});

test('completed node receipt prevents duplicate execution after restore',async()=>{
  let calls=0;const execution=createPlannerExecution({taskPackage:pkg(),handlers:{identify_entity:async()=>{calls++;return {output:{model:'X1'}}},retrieve_primary_manual:async()=>({status:'ask_user',question:'continue?'})}});
  let r=await executePlannerExecution(execution);assert.equal(r.status,'ask_user');assert.equal(calls,1);
  const restored=restorePlannerExecution(checkpointPlannerExecution(execution),{handlers:{identify_entity:async()=>{calls++;return {output:{model:'X1'}}},retrieve_primary_manual:async()=>({status:'ask_user',question:'continue?'})}});
  await executePlannerExecution(restored);assert.equal(calls,1);
});

test('state store checkpoints execution and removes completed execution',async()=>{
  const store=new MemoryTaskStateStore();const execution=createPlannerExecution({taskPackage:{...pkg(),task:createTask({type:'general_qa',userIntent:'解释'})},handlers:{resolve_task:async({context})=>{context.result={answer:'ok'};return {output:context.result}}}});
  const r=await executePlannerExecution(execution,{stateStore:store});assert.equal(r.status,'completed');assert.equal(await store.load(execution.id),null);
});

test('idempotent action executor replays receipt instead of executing action twice',async()=>{
  let writes=0;const proposal=createActionProposal('expense_save',{amount:100},'task-1');const executor=new IdempotentActionExecutor();
  const a=await executor.execute(proposal,async()=>{writes++;return {saved:true}});const b=await executor.execute(proposal,async()=>{writes++;return {saved:true}});
  assert.equal(writes,1);assert.equal(a.replayed,false);assert.equal(b.replayed,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask} from '../core/task/task.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {createPlannerExecution,executePlannerExecution,resumePlannerExecution,cancelPlannerExecution} from '../core/planning/planner-execution-orchestrator.js';

function pkg(type='troubleshooting',intent='诊断这个设备故障并找配件价格'){
  const task=createTask({type,userIntent:intent});
  return compileTaskPackage({task,userIntent:intent,observation:{schemaVersion:1,modality:'image',detectedType:'device',extractedText:'ACME X1',confidence:{identity:.95,overall:.95},entities:[],observations:[],limitations:[]},entityCandidates:[{canonicalName:'ACME X1',category:'device',brand:'ACME',model:'X1',confidence:.96,evidenceRefs:[]}]});
}

test('execution orchestrator runs real graph nodes through registered handlers in dependency order',async()=>{
  const order=[];const p=pkg();
  const execution=createPlannerExecution({taskPackage:p,handlers:{
    identify_entity:async()=>{order.push('identify');return {output:{canonicalName:'ACME X1'}}},
    retrieve_primary_manual:async()=>{order.push('manual');return {output:{url:'manual'}}},
    generate_diagnosis:async()=>{order.push('diagnose');return {output:{cause:'pump'}}},
    verify_diagnosis:async()=>{order.push('verify');return {output:{verified:true}}},
    recommend_solution:async()=>{order.push('solution');return {output:{fix:'replace pump'}}},
    identify_parts:async()=>{order.push('parts');return {output:{part:'P1'}}},
    search_current_prices:async()=>{order.push('prices');return {output:{price:10}}},
    final_recommendation:async({context})=>{order.push('final');context.result={answer:'replace pump'};return {output:context.result}}
  }});
  const r=await executePlannerExecution(execution);
  assert.equal(r.status,'completed');
  assert.deepEqual(order,['identify','manual','diagnose','verify','solution','parts','prices','final']);
  assert.equal(r.resultValue.answer,'replace pump');
});

test('orchestrator pauses on handler ask_user and resumes same graph without rerunning completed nodes',async()=>{
  const p=pkg('manual_lookup','找这个设备的说明书');let identifyCalls=0;
  const execution=createPlannerExecution({taskPackage:p,handlers:{
    identify_entity:async()=>{identifyCalls++;return {status:'ask_user',question:'型号是 X1 吗？'}},
    retrieve_primary_manual:async({dependencyOutputs})=>({output:{manualFor:dependencyOutputs.identify_entity?.model??dependencyOutputs.identify?.model??'X1'}}),
    explain_manual:async({context})=>{context.result={answer:'manual ready'};return {output:context.result}}
  }});
  let r=await executePlannerExecution(execution);assert.equal(r.status,'ask_user');
  const blocked=execution.graph.nodes.find(n=>n.state==='blocked');
  resumePlannerExecution(execution,blocked.id,{output:{model:'X1'}});
  r=await executePlannerExecution(execution);assert.equal(r.status,'completed');assert.equal(identifyCalls,1);assert.equal(r.resultValue.answer,'manual ready');
});

test('optional node failure degrades but final node still executes',async()=>{
  const p=pkg();const execution=createPlannerExecution({taskPackage:p,handlers:{
    identify_entity:async()=>({output:{id:'x'}}),retrieve_primary_manual:async()=>({output:{}}),generate_diagnosis:async()=>({output:{}}),verify_diagnosis:async()=>({output:{verified:true}}),recommend_solution:async()=>({output:{solution:true}}),identify_parts:async()=>({output:{part:'P1'}}),search_current_prices:async()=>{throw new Error('price provider down')},final_recommendation:async({context})=>{context.result={answer:'solution without price'};return {output:context.result}}
  }});const r=await executePlannerExecution(execution);assert.equal(r.status,'completed');assert.equal(r.resultValue.answer,'solution without price');assert.equal(execution.graph.nodes.find(n=>n.id==='prices').state,'failed');
});

test('mandatory node failure stops downstream execution',async()=>{
  const p=pkg('manual_lookup','找说明书');let finalCalled=false;const execution=createPlannerExecution({taskPackage:p,handlers:{identify_entity:async()=>({output:{}}),retrieve_primary_manual:async()=>{throw new Error('search down')},explain_manual:async()=>{finalCalled=true;return {output:{}}}}});const r=await executePlannerExecution(execution);assert.equal(r.status,'failed');assert.equal(finalCalled,false);
});

test('execution can be explicitly cancelled',()=>{const execution=createPlannerExecution({taskPackage:pkg()});cancelPlannerExecution(execution);assert.equal(execution.graph.state,'cancelled');assert.ok(execution.context.trace.includes('graph:cancelled:USER_CANCELLED'))});

test('custom handler overrides default handler without changing planner core',async()=>{
  const p=pkg('general_qa','解释这句话');const execution=createPlannerExecution({taskPackage:p,handlers:{resolve_task:async({context})=>{context.result={answer:'custom'};return {output:context.result}}}});const r=await executePlannerExecution(execution);assert.equal(r.status,'completed');assert.equal(r.resultValue.answer,'custom');
});

test('execution snapshot contains outcomes but not provider secrets',async()=>{
  const p=pkg('general_qa','解释');const execution=createPlannerExecution({taskPackage:p,privacyPolicy:{apiKey:'SECRET'},handlers:{resolve_task:async({context})=>{context.result={answer:'ok'};return {output:context.result}}}});const r=await executePlannerExecution(execution);assert.equal(JSON.stringify(r.snapshot).includes('SECRET'),false);
});

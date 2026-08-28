import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask} from '../core/task/task.js';
import {planTask,shouldPlanTask} from '../core/planning/planner.js';
import {createTaskGraph,validateTaskGraph,readyNodes} from '../core/planning/task-graph.js';
import {runTaskGraph} from '../core/planning/task-graph-runner.js';
import {planningContext} from '../core/planning/planning-context.js';

test('complex repair request gets bounded multi-step task graph',()=>{
 const task=createTask({type:'troubleshooting',userIntent:'识别这个咖啡机故障并找配件价格'});const g=planTask(task);
 assert.equal(shouldPlanTask(task),true);assert.ok(g.nodes.length>=6);assert.equal(g.nodes[0].type,'identify_entity');assert.equal(g.nodes.at(-1).type,'final_recommendation');assert.ok(g.budget.maxSteps<=12);
});

test('simple ordinary task stays a one-node graph',()=>{const task=createTask({type:'general_qa',userIntent:'解释这句话'});const g=planTask(task);assert.equal(g.nodes.length,1);assert.equal(g.nodes[0].type,'resolve_task')});

test('task graph rejects cycles before execution',()=>{assert.throws(()=>createTaskGraph({task:{id:'t',type:'x'},nodes:[{id:'a',type:'x',dependencies:['b']},{id:'b',type:'x',dependencies:['a']}]}),/TASK_GRAPH_CYCLE/)});

test('only dependency-satisfied nodes become ready',()=>{const g=createTaskGraph({task:{id:'t'},nodes:[{id:'a',type:'a'},{id:'b',type:'b',dependencies:['a']}]});assert.deepEqual(readyNodes(g).map(n=>n.id),['a'])});

test('runner executes dependencies in order and completes',async()=>{const g=createTaskGraph({task:{id:'t'},nodes:[{id:'a',type:'a'},{id:'b',type:'b',dependencies:['a']}]});const order=[];const r=await runTaskGraph(g,{handlers:{a:async()=>{order.push('a');return {output:1}},b:async({dependencyOutputs})=>{order.push('b');assert.equal(dependencyOutputs.a,1);return {output:2}}}});assert.equal(r.status,'completed');assert.deepEqual(order,['a','b'])});

test('runner retries within explicit retry budget and never loops forever',async()=>{const g=createTaskGraph({task:{id:'t'},budget:{maxSteps:5,maxRetries:1},nodes:[{id:'a',type:'a',maxRetries:1}]});let calls=0;const r=await runTaskGraph(g,{handlers:{a:async()=>{calls++;if(calls===1)throw new Error('temporary');return {output:'ok'}}}});assert.equal(r.status,'completed');assert.equal(calls,2);assert.equal(g.counters.retries,1)});

test('mandatory node failure stops graph while optional failure can degrade',async()=>{const g=createTaskGraph({task:{id:'t'},nodes:[{id:'a',type:'a'},{id:'optional',type:'bad',dependencies:['a'],optional:true},{id:'final',type:'final',dependencies:['a','optional']}]});const r=await runTaskGraph(g,{handlers:{a:async()=>({output:'ok'}),bad:async()=>{throw new Error('no price')},final:async()=>({output:'answer without optional price'})}});assert.equal(r.status,'completed');assert.equal(g.nodes.find(n=>n.id==='optional').state,'failed')});

test('ask_user pauses graph instead of guessing or continuing',async()=>{const g=createTaskGraph({task:{id:'t'},nodes:[{id:'identify',type:'identify'}]});const r=await runTaskGraph(g,{handlers:{identify:async()=>({status:'ask_user',question:'型号是 A 还是 B？'})}});assert.equal(r.status,'ask_user');assert.equal(g.state,'blocked');assert.match(r.result.question,/A/)});

test('planning context is provider-independent and contains no handler internals',()=>{const g=planTask(createTask({type:'manual_lookup',userIntent:'找说明书'}));const c=planningContext(g);assert.ok(c.nodes.some(n=>n.type==='retrieve_primary_manual'));assert.equal(JSON.stringify(c).includes('openai'),false)});

import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {sanitizeTaskPackage} from '../core/privacy/task-package-sanitizer.js';

test('compiler attaches a provider-independent planning context only for complex tasks',()=>{const task=createTask({type:'question_about_observation',userIntent:'帮我诊断这个设备故障并找配件'});const p=compileTaskPackage({task,userIntent:task.userIntent,observation:{modality:'image',confidence:{identity:.9,overall:.9},entities:[],observations:[],limitations:[]}});assert.ok(p.planning);assert.ok(p.planning.nodes.some(n=>n.type==='verify_diagnosis'));});

test('privacy sanitizer preserves safe task graph metadata but no executor internals',()=>{const task=createTask({type:'troubleshooting',userIntent:'维修这个设备'});const pkg=compileTaskPackage({task,userIntent:task.userIntent});const safe=sanitizeTaskPackage(pkg).package;assert.ok(safe.planning.nodes.length>1);assert.equal(JSON.stringify(safe.planning).includes('handler'),false);});

import {resumeBlockedNode,cancelTaskGraph} from '../core/planning/task-graph.js';

test('blocked graph can resume after user supplies missing information',async()=>{const g=createTaskGraph({task:{id:'t'},nodes:[{id:'identify',type:'identify'},{id:'next',type:'next',dependencies:['identify']}]});let r=await runTaskGraph(g,{handlers:{identify:async()=>({status:'ask_user',question:'型号？'}),next:async({dependencyOutputs})=>({output:`using ${dependencyOutputs.identify.model}`})}});assert.equal(r.status,'ask_user');resumeBlockedNode(g,'identify',{output:{model:'A1'}});r=await runTaskGraph(g,{handlers:{next:async({dependencyOutputs})=>({output:`using ${dependencyOutputs.identify.model}`})}});assert.equal(r.status,'completed');assert.equal(g.nodes.find(n=>n.id==='next').output,'using A1')});

test('user cancellation terminates pending graph explicitly',()=>{const g=planTask(createTask({type:'troubleshooting',userIntent:'维修'}));cancelTaskGraph(g);assert.equal(g.state,'cancelled');assert.ok(g.nodes.every(n=>['cancelled','completed','failed','skipped'].includes(n.state)))});

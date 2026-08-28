import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableAuditLog,MemoryAuditEventStore,sanitizeAuditData} from '../core/audit/durable-event-log.js';
import {replayAudit,explainAuditReplay} from '../core/audit/audit-replay.js';
import {createTask} from '../core/task/task.js';
import {createPlannerExecution,executePlannerExecution} from '../core/planning/planner-execution-orchestrator.js';

test('audit sanitizer removes secrets, raw text and image data while preserving metadata',()=>{
  const safe=sanitizeAuditData({providerId:'teacher-a',apiKey:'SECRET',rawText:'private receipt',answer:'private answer',media:[{dataUrl:'data:image/jpeg;base64,SECRETIMAGE'}],score:.91});
  const text=JSON.stringify(safe);
  assert.equal(text.includes('SECRET'),false);assert.equal(text.includes('private receipt'),false);assert.equal(text.includes('private answer'),false);
  assert.equal(safe.providerId,'teacher-a');assert.equal(safe.score,.91);assert.equal(safe.apiKey.redacted,true);
});

test('durable audit filters by execution and task',()=>{
  const store=new MemoryAuditEventStore();const a=new DurableAuditLog({store,executionId:'ex1',taskId:'t1'});const b=a.child({executionId:'ex2'});
  a.record('one',{providerId:'a'});b.record('two',{providerId:'b'});
  assert.equal(a.list({executionId:'ex1'}).length,1);assert.equal(a.list({executionId:'ex2'}).length,1);
});

test('audit replay explains teacher selection, search, failure and final result without original content',()=>{
  const store=new MemoryAuditEventStore();const a=new DurableAuditLog({store,executionId:'ex',taskId:'t'});
  a.record('planner_graph_started',{});a.record('teacher_attempt',{providerId:'vision-b',score:.92,reasons:['vision_fit']});a.record('search_completed',{query:'private current price query',sourceCount:2});a.record('teacher_error',{providerId:'vision-b',error:'timeout'});a.record('result_rejected',{providerId:'vision-b',reason:'VALIDATION_FAILED'});a.record('planner_graph_stopped',{state:'failed',reason:'NODE_FAILED'});
  const events=a.list();const text=JSON.stringify(events);assert.equal(text.includes('private current price query'),false);
  const replay=replayAudit(events);assert.equal(replay.teacherSelections[0].providerId,'vision-b');assert.equal(replay.failures.length,1);assert.equal(replay.finalDecision.type,'result_rejected');assert.match(explainAuditReplay(replay),/vision-b/);
});

test('planner execution emits durable black-box events',async()=>{
  const store=new MemoryAuditEventStore();const audit=new DurableAuditLog({store});const task=createTask({type:'general_qa',userIntent:'private question'});const pkg={schemaVersion:2,task,userIntent:task.userIntent,evidence:[],entities:[],privacy:{},safety:{sensitiveData:false}};
  const execution=createPlannerExecution({taskPackage:pkg,audit,handlers:{resolve_task:async({context})=>{context.result={answer:'private result'};return {output:context.result}}}});
  const r=await executePlannerExecution(execution);assert.equal(r.status,'completed');const events=store.list({executionId:execution.id});
  assert.ok(events.some(e=>e.type==='planner_graph_started'));assert.ok(events.some(e=>e.type==='planner_node_completed'));assert.ok(events.some(e=>e.type==='execution_finished'));
  const text=JSON.stringify(events);assert.equal(text.includes('private question'),false);assert.equal(text.includes('private result'),false);
});

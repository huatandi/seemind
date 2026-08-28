import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrchestrationContext} from '../core/orchestration/orchestration-context.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';
import {ExecutionDispatcher,runOrchestrationLoop} from '../core/orchestration/execution-dispatcher.js';
import {createResultEnvelope} from '../core/orchestration/result-envelope.js';
import {auditMainlineFlow} from '../core/brain/mainline-e2e-audit.js';

function accepted(route){return {status:'ACCEPT',accepted:true,route,reason:'ok'}}

test('accepted SEARCH does not re-trigger stale answerability SEARCH forever',async()=>{
 const initial=buildOrchestrationContext({
  task:{type:'question'},
  capabilities:{searchAvailable:true,teacherCount:1},
  answerability:{decision:'SEARCH',freshnessRequired:true},
  explanation:{retrievalPlan:{shouldSearch:true,queries:['q']}},
  taskPackage:{search:{status:'pending'},evidenceConsensus:{status:'unknown'}}
 });
 const dispatcher=new ExecutionDispatcher({executors:{
  SEARCH:async()=>createResultEnvelope({route:'SEARCH',status:'completed',result:{evidence:[{id:'e1',url:'https://example.test'}]},taskPackage:{search:{status:'completed'},evidenceConsensus:{status:'consistent',recommendation:'use_consensus'},evidence:[{id:'e1',url:'https://example.test'}]},requiresVerification:true})
 }});
 const flow=await runOrchestrationLoop({initialContext:initial,decide:({context})=>orchestrate({context}),dispatcher,verify:async()=>accepted('SEARCH'),maxTransitions:4});
 assert.equal(flow.status,'completed');
 assert.deepEqual(flow.transitions.map(x=>x.contract.route),['SEARCH','LOCAL']);
});

test('accepted TEACHER does not re-trigger stale answerability TEACHER forever',async()=>{
 const initial=buildOrchestrationContext({
  task:{type:'question'},capabilities:{searchAvailable:false,teacherCount:1},
  answerability:{decision:'TEACHER'},
 });
 const dispatcher=new ExecutionDispatcher({executors:{
  TEACHER:async()=>createResultEnvelope({route:'TEACHER',status:'completed',result:{answer:'candidate'},requiresVerification:true})
 }});
 const flow=await runOrchestrationLoop({initialContext:initial,decide:({context})=>orchestrate({context}),dispatcher,verify:async()=>({status:'ACCEPT_WITH_CAVEAT',accepted:true,route:'TEACHER',reason:'ok'}),maxTransitions:4});
 assert.equal(flow.status,'completed');
 assert.deepEqual(flow.transitions.map(x=>x.contract.route),['TEACHER','LOCAL']);
});

test('E2E audit flags duplicated external work and transition exhaustion',()=>{
 const flow={status:'max_transitions',transitions:[
  {contract:{route:'SEARCH',reason:'same'}},{contract:{route:'SEARCH',reason:'same'}}
 ],context:{}};
 const audit=auditMainlineFlow({flow});
 assert.equal(audit.healthy,false);
 assert.ok(audit.issues.some(x=>x.code==='DUPLICATE_EXTERNAL_ROUTE'));
 assert.ok(audit.issues.some(x=>x.code==='MAX_TRANSITIONS_REACHED'));
});

test('E2E audit reports latency regressions from the real runtime observation',()=>{
 const observation={observations:[{kind:'runtime_latency',totalMs:4200,firstUsefulMs:1400,localWithinBudget:false,firstUsefulWithinBudget:false,budgetTier:'low_power'}]};
 const audit=auditMainlineFlow({flow:{status:'completed',transitions:[],context:{}},observation});
 assert.equal(audit.healthy,true);
 assert.ok(audit.issues.some(x=>x.code==='LOCAL_LATENCY_BUDGET_EXCEEDED'));
 assert.ok(audit.issues.some(x=>x.code==='FIRST_USEFUL_FEEDBACK_LATE'));
});

test('orchestration loop stops before executing a third identical external call',async()=>{
 const initial=buildOrchestrationContext({task:{},capabilities:{searchAvailable:true}});
 let calls=0;
 const dispatcher=new ExecutionDispatcher({executors:{SEARCH:async()=>{calls++;return createResultEnvelope({route:'SEARCH',status:'completed',result:{},requiresVerification:true})}}});
 const decide=()=>({schemaVersion:1,authority:'unified_orchestrator',route:'SEARCH',reason:'repeat',details:{},alternatives:[],nextStage:'RETRIEVE',mustReenter:true,terminal:false});
 const flow=await runOrchestrationLoop({initialContext:initial,decide,dispatcher,verify:async()=>({status:'NEED_MORE_EVIDENCE',accepted:false,route:'SEARCH'}),maxTransitions:6,routeBudget:{maxExternalCalls:4,maxSameRoute:2}});
 assert.equal(flow.status,'route_budget_exhausted');
 assert.equal(calls,2);
 assert.equal(flow.reason,'MAX_SEARCH_CALLS');
});

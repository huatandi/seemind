import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrchestrationContext} from '../core/orchestration/orchestration-context.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';
import {ExecutionDispatcher,runOrchestrationLoop} from '../core/orchestration/execution-dispatcher.js';
import {createResultEnvelope} from '../core/orchestration/result-envelope.js';

function ctx(overrides={}){
 return buildOrchestrationContext({
  task:{type:'question'},
  observation:{confidence:{overall:.5},limitations:[]},
  explanation:{},
  capabilities:{searchAvailable:false,teacherCount:0,plannerAvailable:true},
  ...overrides,
 });
}

test('R3 safety overrides Answerability SEARCH and blocks external retrieval',()=>{
 const context=ctx({
  explanation:{safety:{risk:{level:'R3'},escalation:{category:'qualified_professional'}}},
  capabilities:{searchAvailable:true,teacherCount:1,plannerAvailable:true},
  answerability:{decision:'SEARCH',freshnessRequired:true},
 });
 const d=orchestrate({context});
 assert.equal(d.route,'HUMAN');
 assert.equal(d.reason,'safety_requires_protective_handoff');
});

test('R3 safety overrides Answerability TEACHER',()=>{
 const context=ctx({
  explanation:{safety:{risk:{level:'R3'}}},
  capabilities:{searchAvailable:false,teacherCount:1},
  answerability:{decision:'TEACHER'},
 });
 assert.equal(orchestrate({context}).route,'HUMAN');
});

test('fresh retrieval required but Search unavailable does not pretend local freshness',()=>{
 const context=ctx({
  explanation:{retrievalPlan:{shouldSearch:true,needsFreshness:true}},
  capabilities:{searchAvailable:false,teacherCount:0},
 });
 const d=orchestrate({context});
 assert.equal(d.route,'STOP');
 assert.equal(d.reason,'retrieval_required_but_unavailable');
});

test('failed Search verification terminates instead of presenting failed external output',async()=>{
 const initial=ctx({
  explanation:{retrievalPlan:{shouldSearch:true,queries:['fresh fact']}},
  capabilities:{searchAvailable:true,teacherCount:0},
 });
 const dispatcher=new ExecutionDispatcher({executors:{
  SEARCH:async()=>createResultEnvelope({route:'SEARCH',status:'failed',reason:'network_down',error:{message:'offline'},requiresVerification:true})
 }});
 const flow=await runOrchestrationLoop({
  initialContext:initial,
  decide:({context})=>orchestrate({context}),
  dispatcher,
  verify:async({envelope})=>({status:'REJECT',accepted:false,route:envelope.route,reason:'execution_failed'}),
  maxTransitions:4,
  routeBudget:{maxExternalCalls:3,maxSameRoute:2},
 });
 assert.deepEqual(flow.transitions.map(x=>x.contract.route),['SEARCH','STOP']);
});

test('accepted Teacher candidate re-enters and becomes LOCAL presentation route',async()=>{
 const initial=ctx({
  capabilities:{searchAvailable:false,teacherCount:1},
  answerability:{decision:'TEACHER'},
 });
 const dispatcher=new ExecutionDispatcher({executors:{
  TEACHER:async()=>createResultEnvelope({route:'TEACHER',status:'completed',result:{answer:'candidate'},requiresVerification:true})
 }});
 const flow=await runOrchestrationLoop({
  initialContext:initial,
  decide:({context})=>orchestrate({context}),
  dispatcher,
  verify:async()=>({status:'ACCEPT_WITH_CAVEAT',accepted:true,route:'TEACHER',reason:'candidate'}),
  maxTransitions:4,
 });
 assert.deepEqual(flow.transitions.map(x=>x.contract.route),['TEACHER','LOCAL']);
});

test('conflicting verified external evidence stops rather than being synthesized as certainty',async()=>{
 const initial=ctx({
  explanation:{retrievalPlan:{shouldSearch:true,queries:['q']}},
  capabilities:{searchAvailable:true,teacherCount:1},
 });
 const dispatcher=new ExecutionDispatcher({executors:{
  SEARCH:async()=>createResultEnvelope({route:'SEARCH',status:'completed',result:{evidence:[]},requiresVerification:true})
 }});
 const flow=await runOrchestrationLoop({
  initialContext:initial,
  decide:({context})=>orchestrate({context}),
  dispatcher,
  verify:async()=>({status:'CONFLICT',accepted:false,route:'SEARCH',reason:'sources_disagree'}),
  maxTransitions:4,
 });
 assert.deepEqual(flow.transitions.map(x=>x.contract.route),['SEARCH','STOP']);
 assert.equal(flow.transitions.at(-1).contract.reason,'verification_conflict_must_be_reported');
});

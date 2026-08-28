import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyExecutionResult} from '../core/verification/verification-core.js';
import {createResultEnvelope} from '../core/orchestration/result-envelope.js';
import {ExecutionDispatcher,runOrchestrationLoop} from '../core/orchestration/execution-dispatcher.js';
import {buildOrchestrationContext} from '../core/orchestration/orchestration-context.js';

test('failed execution is rejected by verification authority',()=>{
 const v=verifyExecutionResult({envelope:createResultEnvelope({route:'SEARCH',status:'failed',error:'boom'})});
 assert.equal(v.authority,'verification_core');assert.equal(v.accepted,false);assert.equal(v.status,'REJECT');
});
test('R3 blocks externally produced result from authorizing action',()=>{
 const v=verifyExecutionResult({envelope:createResultEnvelope({route:'TEACHER',result:{text:'do it'}}),context:{safety:{risk:{level:'R3'}}}});
 assert.equal(v.status,'SAFETY_BLOCK');assert.equal(v.accepted,false);
});
test('search without qualified evidence cannot be accepted',()=>{
 const v=verifyExecutionResult({envelope:createResultEnvelope({route:'SEARCH',result:{results:[]}}),context:{task:{type:'question'}}});
 assert.equal(v.status,'NEED_MORE_EVIDENCE');assert.equal(v.accepted,false);
});
test('independent conflicting evidence is not silently accepted',()=>{
 const evidence=[
  {id:'a',url:'https://agency.gov/a',publisher:'Agency',sourceType:'government',credibility:1,relevance:1,claimKey:'value',claimValue:'A',isPrimarySource:true},
  {id:'b',url:'https://other.gov/b',publisher:'Other',sourceType:'government',credibility:1,relevance:1,claimKey:'value',claimValue:'B',isPrimarySource:true},
 ];
 const v=verifyExecutionResult({envelope:createResultEnvelope({route:'SEARCH',result:{evidence}}),context:{task:{type:'question'}}});
 assert.equal(v.status,'CONFLICT');assert.equal(v.accepted,false);
});
test('teacher output without structured claims is accepted only with caveat',()=>{
 const v=verifyExecutionResult({envelope:createResultEnvelope({route:'TEACHER',result:{text:'candidate'}}),context:{task:{type:'question'},safety:{risk:{level:'R0'}}}});
 assert.equal(v.status,'ACCEPT_WITH_CAVEAT');assert.equal(v.accepted,true);
});
test('orchestration loop refuses nonterminal reentry without verifier',async()=>{
 const dispatcher=new ExecutionDispatcher({executors:{TEACHER:async()=>({status:'completed',result:{text:'x'}})}});
 const initialContext=buildOrchestrationContext({capabilities:{teacherCount:1}});
 const decide=()=>({authority:'unified_orchestrator',route:'TEACHER',reason:'x',mustReenter:true,terminal:false,nextStage:'CALL_SPECIALIST'});
 const r=await runOrchestrationLoop({initialContext,decide,dispatcher,maxTransitions:1});
 assert.equal(r.status,'verification_required');assert.equal(r.reason,'VERIFIER_REQUIRED');
});
test('verified nonterminal result records verdict before reentry',async()=>{
 const dispatcher=new ExecutionDispatcher({executors:{TEACHER:async()=>({status:'completed',result:{text:'x'}})}});
 const initialContext=buildOrchestrationContext({capabilities:{teacherCount:1}});
 let calls=0;
 const decide=()=>calls++===0?({authority:'unified_orchestrator',route:'TEACHER',reason:'x',mustReenter:true,terminal:false,nextStage:'CALL_SPECIALIST'}):({authority:'unified_orchestrator',route:'LOCAL',reason:'done',mustReenter:false,terminal:true,nextStage:'EXPLAIN'});
 const r=await runOrchestrationLoop({initialContext,decide,dispatcher,verify:verifyExecutionResult,maxTransitions:2});
 assert.equal(r.status,'completed');assert.equal(r.context.verification.verdict.authority,'verification_core');
});

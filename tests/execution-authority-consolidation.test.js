import test from 'node:test';
import assert from 'node:assert/strict';
import {ExecutionDispatcher,runOrchestrationLoop} from '../core/orchestration/execution-dispatcher.js';
import {buildOrchestrationContext} from '../core/orchestration/orchestration-context.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';
import {createRouteContract} from '../core/orchestration/route-contract.js';
import {verifyExecutionResult} from '../core/verification/verification-core.js';

const baseExplanation={safety:{risk:{level:'R0'}},resolution:{decision:'teacher_or_tool',escalation:{needed:true}},retrievalPlan:{localCanAnswer:false,shouldSearch:true,queries:['q']},intentPlan:{sequence:['identify']},evidenceAnalysis:{gaps:[]}};

test('dispatcher rejects execution not authorized by unified orchestrator',async()=>{
 const d=new ExecutionDispatcher();
 await assert.rejects(()=>d.execute({contract:{route:'TEACHER'},context:{}}),/UNAUTHORIZED_ROUTE_CONTRACT/);
});

test('dispatcher invokes only the executor selected by route contract',async()=>{
 const calls=[];const d=new ExecutionDispatcher({executors:{SEARCH:async()=>{calls.push('SEARCH');return {status:'completed',result:{ok:true}}},TEACHER:async()=>{calls.push('TEACHER')}}});
 const c=buildOrchestrationContext({explanation:baseExplanation,capabilities:{teacherCount:1,searchAvailable:true}});
 const contract=orchestrate({context:c});
 await d.execute({contract,context:c});
 assert.deepEqual(calls,['SEARCH']);
});

test('terminal local route does not require specialist executor',async()=>{
 const d=new ExecutionDispatcher();
 const c=buildOrchestrationContext({explanation:{...baseExplanation,resolution:{decision:'local_explain'},retrievalPlan:{localCanAnswer:true,shouldSearch:false}},capabilities:{}});
 const contract=orchestrate({context:c});const r=await d.execute({contract,context:c});
 assert.equal(contract.route,'LOCAL');assert.equal(r.result.action,'present_local_explanation');assert.equal(r.requiresVerification,false);
});

test('nonterminal search is forced through re-entry before final local answer',async()=>{
 const c=buildOrchestrationContext({explanation:baseExplanation,capabilities:{teacherCount:0,searchAvailable:true}});
 const dispatcher=new ExecutionDispatcher({executors:{SEARCH:async()=>({status:'completed',taskPackage:{search:{status:'completed'},evidenceConsensus:{status:'consistent',recommendation:'use_consensus'},evidenceRetrieval:{action:'accept'}},result:{sources:2}})}});
 const out=await runOrchestrationLoop({initialContext:c,decide:orchestrate,dispatcher,verify:({envelope})=>({authority:'verification_core',status:'ACCEPT',accepted:true,reason:'fixture_verified'})});
 assert.equal(out.transitions[0].contract.route,'SEARCH');assert.equal(out.transitions[1].contract.route,'LOCAL');assert.equal(out.status,'completed');
});

test('teacher result must re-enter instead of being automatically final',async()=>{
 const ex={...baseExplanation,retrievalPlan:{localCanAnswer:false,shouldSearch:false},intentPlan:{sequence:['solve']}};
 const c=buildOrchestrationContext({explanation:ex,capabilities:{teacherCount:1,searchAvailable:false}});
 let teacherCalls=0;
 const dispatcher=new ExecutionDispatcher({executors:{TEACHER:async()=>{teacherCalls++;return {status:'completed',result:{answer:'candidate'},taskPackage:{}}}}});
 const first=orchestrate({context:c});assert.equal(first.route,'TEACHER');
 const executed=await dispatcher.execute({contract:first,context:c});assert.equal(executed.requiresVerification,true);assert.equal(teacherCalls,1);
});

test('max transition bound prevents unbounded agent loop',async()=>{
 const c=buildOrchestrationContext({explanation:baseExplanation,capabilities:{teacherCount:0,searchAvailable:true}});
 const dispatcher=new ExecutionDispatcher({executors:{SEARCH:async()=>({status:'completed',taskPackage:{search:{status:'pending'}},result:{}})}});
 const decide=({context})=>createRouteContract({route:'SEARCH',reason:'test_loop',context,details:{}});
 const out=await runOrchestrationLoop({initialContext:c,decide,dispatcher,verify:()=>({authority:'verification_core',status:'ACCEPT',accepted:true,reason:'fixture_verified'}),maxTransitions:3});
 assert.equal(out.status,'max_transitions');assert.equal(out.transitions.length,3);
});

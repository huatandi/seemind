import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWebCapabilityExecutors} from '../apps/web/src/runtime/web-capability-executors.js';
import {buildOrchestrationContext,reentryContext} from '../core/orchestration/orchestration-context.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';

test('web mainline contains no direct specialist or reentry bypass',async()=>{
 const src=await readFile(new URL('../apps/web/src/main.js',import.meta.url),'utf8');
 for(const forbidden of [
   /\baskTeacher\s*\(/,
   /\bprepareGroundedTask\s*\(/,
   /\bexecutePlannerExecution\s*\(/,
   /\breentryContext\s*\(/,
   /authority\s*:\s*['"]unified_orchestrator['"]/,
   /\bexecutionDispatcher\.execute\s*\(/,
 ]) assert.doesNotMatch(src,forbidden);
 assert.match(src,/runOrchestrationLoop\s*\(/);
 assert.match(src,/verify\s*:\s*verifyExecutionResult/);
});

test('retrieval-plan search executes approved query even when legacy package search.required is false',async()=>{
 let pkg={task:{type:'image_explain',userIntent:'这是什么植物'},search:{required:false},evidence:[]};
 const seen=[];
 const executors=createWebCapabilityExecutors({
   getTaskPackage:()=>pkg,setTaskPackage:v=>{pkg=v},
   getObservation:()=>({detectedType:'plant',observations:[]}),
   getVisionAttachment:()=>null,getConversation:()=>[],
   getProviders:()=>[],getSearchProvider:()=>({search:async plan=>{seen.push(plan.query);return {evidence:[{id:'e1',type:'search',title:'Plant DB',url:'https://plants.example/a',publisher:'Plant DB',credibility:.9,relevance:.9,claimKey:'species',claimValue:'x'}]}}}),
   getVerifiedEntity:()=>null,setVerifiedEntity:()=>{},
   getPendingExecution:()=>null,setPendingExecution:()=>{},
   requestConsent:async()=>true,
 });
 const r=await executors.SEARCH({contract:{details:{queries:['leaf identification']}}});
 assert.equal(r.status,'completed');assert.deepEqual(seen,['leaf identification']);assert.equal(r.taskPackage.search.status,'completed');assert.equal(r.taskPackage.evidence.length,1);
});

test('search executor cannot secretly call a teacher for identity',async()=>{
 let pkg={task:{type:'x'},search:{required:true,blocked:false,query:'x'},identity:{required:true,ok:false},evidence:[]};
 let teacherTouched=false;
 const executors=createWebCapabilityExecutors({
  getTaskPackage:()=>pkg,setTaskPackage:v=>{pkg=v},getObservation:()=>({observations:[]}),getVisionAttachment:()=>null,getConversation:()=>[],
  getProviders:()=>[{execute:async()=>{teacherTouched=true}}],
  getSearchProvider:()=>({search:async()=>({evidence:[]})}),getVerifiedEntity:()=>null,setVerifiedEntity:()=>{},
  getPendingExecution:()=>null,setPendingExecution:()=>{},requestConsent:async()=>true
 });
 const r=await executors.SEARCH({contract:{details:{queries:['x']}}});
 assert.equal(teacherTouched,false);assert.equal(r.reason,'identity_needed_before_search');
});

test('accepted teacher verification re-enters and only Orchestrator authorizes presentation',()=>{
 const explanation={safety:{risk:{level:'R0'}},resolution:{decision:'teacher_or_tool',escalation:{needed:true}},retrievalPlan:{localCanAnswer:false,shouldSearch:false},intentPlan:{sequence:['solve']},evidenceAnalysis:{gaps:[]}};
 let c=buildOrchestrationContext({explanation,capabilities:{teacherCount:1}});
 c=reentryContext(c,{phase:'POST_VERIFY_TEACHER',teacherState:{answer:{answer:'candidate'}},verification:{authority:'verification_core',route:'TEACHER',status:'ACCEPT_WITH_CAVEAT',accepted:true,reason:'candidate'}});
 const d=orchestrate({context:c});
 assert.equal(d.route,'LOCAL');assert.equal(d.reason,'verified_teacher_candidate_ready_with_caveat');
});

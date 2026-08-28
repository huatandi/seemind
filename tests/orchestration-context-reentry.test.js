import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrchestrationContext,reentryContext,appendOrchestrationEvent} from '../core/orchestration/orchestration-context.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';

const explanation={
 safety:{risk:{level:'R0'}},
 resolution:{decision:'teacher_or_tool',escalation:{needed:true}},
 retrievalPlan:{localCanAnswer:false,shouldSearch:true,queries:['q']},
 intentPlan:{sequence:['identify']},
 evidenceAnalysis:{gaps:[]},
};

test('context preserves specialist stage outputs instead of flattening them',()=>{
 const c=buildOrchestrationContext({task:{type:'x'},observation:{detectedType:'product',confidence:{overall:.6},limitations:['uncertain'],observations:[{kind:'ocr'}]},explanation,capabilities:{teacherCount:2,searchAvailable:true}});
 assert.equal(c.perception.detectedType,'product');
 assert.equal(c.evidence.resolution.decision,'teacher_or_tool');
 assert.equal(c.retrieval.plan.shouldSearch,true);
 assert.equal(c.external.teacherCount,2);
});
test('route contract records reason, rejected alternatives and next stage',()=>{
 const c=buildOrchestrationContext({task:{},observation:{},explanation,capabilities:{teacherCount:2,searchAvailable:true}});
 const d=orchestrate({context:c});
 assert.equal(d.route,'SEARCH');assert.equal(d.nextStage,'RETRIEVE');assert.equal(d.mustReenter,true);
 assert.ok(d.alternatives.some(x=>x.route==='TEACHER'));
});
test('search completion re-enters orchestrator rather than becoming answer automatically',()=>{
 let c=buildOrchestrationContext({task:{},observation:{},explanation,capabilities:{teacherCount:0,searchAvailable:true}});
 c=reentryContext(c,{phase:'POST_RETRIEVAL',taskPackage:{search:{status:'completed'},evidenceConsensus:{status:'consistent',recommendation:'use_consensus'},evidenceRetrieval:{action:'accept'}}});
 const d=orchestrate({context:c});
 assert.equal(d.route,'LOCAL');assert.equal(d.reason,'retrieval_verified_local_synthesis_allowed');
});
test('verified retrieval can still hand off synthesis when intent needs specialist reasoning',()=>{
 const ex={...explanation,intentPlan:{sequence:['diagnose']}};
 let c=buildOrchestrationContext({task:{},observation:{},explanation:ex,capabilities:{teacherCount:1,searchAvailable:true}});
 c=reentryContext(c,{phase:'POST_RETRIEVAL',taskPackage:{search:{status:'completed'},evidenceConsensus:{status:'consistent',recommendation:'use_consensus'},evidenceRetrieval:{action:'accept'}}});
 const d=orchestrate({context:c});
 assert.equal(d.route,'TEACHER');assert.equal(d.reason,'retrieval_verified_specialist_synthesis_needed');
});
test('unresolved retrieval conflict is reported instead of silently averaged',()=>{
 let c=buildOrchestrationContext({task:{},observation:{},explanation,capabilities:{teacherCount:1,searchAvailable:true}});
 c=reentryContext(c,{phase:'POST_RETRIEVAL',taskPackage:{search:{status:'completed'},evidenceConsensus:{status:'conflict',recommendation:'search_more_or_report_disagreement'},evidenceRetrieval:{action:'report'}}});
 const d=orchestrate({context:c});
 assert.equal(d.route,'STOP');assert.equal(d.reason,'retrieval_conflict_must_be_reported');
});
test('execution history survives re-entry',()=>{
 let c=buildOrchestrationContext({task:{},observation:{},explanation,capabilities:{}});
 c=appendOrchestrationEvent(c,{stage:'ASSESS',route:'SEARCH',status:'selected',reason:'need evidence'});
 c=reentryContext(c,{phase:'POST_RETRIEVAL',event:{stage:'RETRIEVE',status:'completed'}});
 assert.equal(c.executionHistory.length,2);assert.equal(c.executionHistory[0].route,'SEARCH');
});

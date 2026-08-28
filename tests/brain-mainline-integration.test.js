import test from 'node:test';
import assert from 'node:assert/strict';
import {runBrainMainline} from '../core/brain/brain-mainline.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {createRuntimeLatencyBudget,evaluateRuntimeLatency,shouldRunHeavyLocalStage} from '../core/performance/runtime-latency-budget.js';

test('brain mainline actually puts Problem State and Answerability before final routing',()=>{
 const observation={confidence:{overall:.82},limitations:[],observations:[]};
 const explanation={problem:{intentHypotheses:[{intent:'troubleshoot'}],referencedObjects:[],knownFacts:[],unknownFacts:[{type:'target'}]},retrievalPlan:{needsFreshness:false},safety:{risk:{level:'R0',requiresExpert:false}}};
 const out=runBrainMainline({task:{type:'question_about_observation'},observation,explanation,capabilities:{searchAvailable:true,teacherCount:1}});
 assert.equal(out.answerability.decision,'CLARIFY');
 assert.equal(out.decision.route,'CLARIFY');
 assert.equal(out.context.understanding.answerability.reason,'TARGET_NOT_GROUNDED');
 assert.ok(out.problemState.routeHistory.some(x=>x.route==='CLARIFY'));
});

test('brain mainline sends freshness through Search when available',()=>{
 const observation={confidence:{overall:.95},limitations:[],observations:[]};
 const explanation={problem:{intentHypotheses:[{intent:'identify'}],referencedObjects:[{groundedRegionId:'r1'}],knownFacts:[{id:'f1'}],unknownFacts:[]},retrievalPlan:{needsFreshness:true,shouldSearch:true,queries:['model current status']},safety:{risk:{level:'R0'}}};
 const out=runBrainMainline({task:{},observation,explanation,capabilities:{searchAvailable:true,teacherCount:1}});
 assert.equal(out.answerability.decision,'SEARCH');
 assert.equal(out.decision.route,'SEARCH');
});

test('teacher task package carries compact problem and answerability instead of making teacher restart',()=>{
 const problemState={target:{id:'r1',label:'router'},goal:'troubleshoot',symptoms:[{text:'red light'}],attemptedActions:[{text:'restart'}]};
 const answerability={decision:'TEACHER',localConfidence:.42,evidenceCompleteness:.61};
 const p=compileTaskPackage({task:{type:'question_about_observation'},observation:{confidence:{overall:.4},limitations:[]},problemState,answerability});
 assert.equal(p.problemState.target.label,'router');
 assert.equal(p.answerability.decision,'TEACHER');
});

test('weak phone latency budget defers heavy work after fast-path deadline',()=>{
 const b=createRuntimeLatencyBudget({tier:'low_power'});
 assert.equal(shouldRunHeavyLocalStage({elapsedMs:1900,budget:b,deviceProfile:{tier:'low_power'}}).allowed,false);
 const e=evaluateRuntimeLatency({startedAt:1000,firstUsefulAt:1700,completedAt:3500,budget:b});
 assert.equal(e.firstUsefulWithinBudget,true);assert.equal(e.localWithinBudget,true);
});

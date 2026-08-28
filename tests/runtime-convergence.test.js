import test from 'node:test';import assert from 'node:assert/strict';
import {assessRuntimePerception,convergeProblemRuntime} from '../apps/web/src/runtime/runtime-convergence.js';

test('production convergence facade sends weak receipt perception through quality recovery',()=>{
 const x=assessRuntimePerception({detectedType:'receipt',confidence:{fact:.4,overall:.5},observations:[]});
 assert.equal(x.gate.needsRecovery,true);assert.ok(x.recovery);assert.ok(x.adaptive);
});
test('production convergence facade keeps strong ordinary image observation usable without recovery',()=>{
 const x=assessRuntimePerception({detectedType:'object',confidence:{overall:.92},observations:[]});
 assert.equal(x.gate.disposition,'ACCEPT_AS_OBSERVATION');assert.equal(x.recovery,null);
});
test('complex shopping intent reaches composition planning and resolution through one runtime adapter',()=>{
 const task={type:'question_about_observation',userIntent:'这是什么？附近哪里可以买？哪家价格划算？有什么区别？'};
 const x=convergeProblemRuntime({task,universal:{multimodal:{}},brain:{answerability:{unknowns:[{type:'identity'},{type:'price'},{type:'local'}],confidence:.5}}});
 assert.ok(x.composition.jobs.length>=3);assert.equal(x.planning.needsPlanningSpecialist,true);assert.equal(x.resolution.status,'investigating');
 assert.equal(x.sourceOfTruth,'PROBLEM_SESSION');assert.equal(x.brainStateRole,'DERIVED_WORKING_VIEW');
});

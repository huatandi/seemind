import test from 'node:test';import assert from 'node:assert/strict';
import {composeSpecialistJobs,readySpecialistJobs,validateSpecialistComposition} from '../core/orchestration/multi-specialist-composition.js';

test('shopping question is decomposed by capability rather than duplicated across multiple AIs',()=>{
 const x=composeSpecialistJobs({task:{userIntent:'这个商品附近哪里可以买，哪家价格划算，有什么区别？'},student:{exactIdentity:'SKU-1'}});
 assert.deepEqual(x.jobs.map(j=>j.id),['retail','local','reason']);
 assert.deepEqual(x.jobs.find(j=>j.id==='reason').dependsOn.sort(),['local','retail']);
 assert.equal(x.strategy,'SPECIALISTS_BY_SUBPROBLEM_NOT_MODEL_VOTING');
 assert.equal(x.finalSynthesisOwner,'SEEMIND');
 assert.equal(validateSpecialistComposition(x),true);
});
test('unknown identity becomes a prerequisite instead of asking every specialist to re-identify',()=>{
 const x=composeSpecialistJobs({task:{userIntent:'这个商品是什么，附近哪里买，哪个便宜？'},student:{}});
 assert.equal(x.jobs[0].id,'identity');
 assert.ok(x.jobs.find(j=>j.id==='retail').dependsOn.includes('identity'));
 assert.equal(readySpecialistJobs(x,[]).map(j=>j.id)[0],'identity');
});
test('independent retail and local discovery can run in parallel after identity is already known',()=>{
 const x=composeSpecialistJobs({task:{userIntent:'这个商品附近哪里可以买，哪家价格便宜？'},student:{barcodeIdentity:'123'}});
 const ready=readySpecialistJobs(x,[]).map(j=>j.id);
 assert.ok(ready.includes('retail'));assert.ok(ready.includes('local'));
});
test('composition is bounded and specialist outputs remain candidate evidence',()=>{
 const x=composeSpecialistJobs({task:{userIntent:'商品价格附近比较推荐'},student:{},freshness:{required:true},evidencePolicy:{officialRequired:true}});
 assert.ok(x.jobs.length<=5);assert.ok(x.jobs.every(j=>j.outputPolicy==='CANDIDATE_EVIDENCE_ONLY'));assert.equal(validateSpecialistComposition(x),true);
});

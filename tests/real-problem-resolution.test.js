import test from 'node:test';import assert from 'node:assert/strict';
import {assessProblemResolution,deriveNextResolutionAction,canCloseProblem} from '../core/resolution/problem-resolution-state.js';

test('specialist returning an answer does not mean the user problem is resolved',()=>{
 const x=assessProblemResolution({subgoals:[{id:'identity',text:'identify'},{id:'retail',text:'find current price'}],specialistJobs:[{id:'identity',status:'returned'}]});
 assert.equal(x.status,'investigating');assert.equal(x.externallyAnswered,true);assert.equal(x.resolutionRatio,0);assert.equal(canCloseProblem(x),false);
});
test('verified subgoals produce a resolved candidate but preserve distinction from user confirmation',()=>{
 const x=assessProblemResolution({subgoals:[{id:'identity'},{id:'retail'}],verifiedEvidence:[{verified:true,resolves:['identity']},{verified:true,resolves:['retail']}]});
 assert.equal(x.status,'resolved_candidate');assert.equal(x.resolutionRatio,1);assert.equal(x.userConfirmed,false);assert.equal(canCloseProblem(x),true);
});
test('explicit user report that problem is still unresolved overrides apparent completion',()=>{
 const x=assessProblemResolution({subgoals:[{id:'identity',resolved:true}],userOutcome:'not_resolved'});
 assert.equal(x.status,'investigating');assert.equal(x.reason,'USER_CONFIRMED_NOT_RESOLVED');assert.equal(canCloseProblem(x),false);
});
test('unresolved goal maps to the next relevant specialist job instead of repeating completed work',()=>{
 const r=assessProblemResolution({subgoals:[{id:'identity',resolved:true},{id:'retail'}]});
 const action=deriveNextResolutionAction({resolution:r,composition:{jobs:[{id:'identity'},{id:'retail'}]}});
 assert.equal(action.jobId,'retail');
});

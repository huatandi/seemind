import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemSolvingSession,updateProblemSolvingSession,planGuidedTroubleshooting} from '../core/resolution/problem-solving-session.js';
import {updateProblemState,createProblemState} from '../core/resolution/problem-state.js';

test('power-cycle attempt suppresses generic basic power-path suggestion',()=>{
 let state=createProblemSolvingSession();
 state=updateProblemSolvingSession(state,{userText:'我已经重启过了，还是不行。'});
 const problem={userQuestion:'还是不工作',referencedObjects:[],symptoms:[{type:'not_working',sourceText:'不工作'}]};
 const resolution={nextEvidence:[],escalation:{needed:false}};
 const plan=planGuidedTroubleshooting({state,problem,resolution,helpPath:null,evidenceRequest:null});
 assert.notEqual(plan.nextStep?.actionId,'basic_power_path');
 assert.ok(plan.avoidedRepeats>=1);
});

test('failed attempt outcome is retained and copied into Brain Problem State',()=>{
 let state=createProblemSolvingSession();
 state=updateProblemSolvingSession(state,{userText:'我已经重启过了，还是不行。'});
 assert.equal(state.attemptResults.length,1);
 assert.equal(state.attemptResults[0].actionId,'power_cycle');
 assert.equal(state.attemptResults[0].outcome,'not_resolved');

 const brain=updateProblemState(createProblemState(),{problemSession:state});
 assert.ok(brain.results.some(x=>x.actionId==='power_cycle'&&x.outcome==='not_resolved'));
});

test('semantically equivalent restart wording deduplicates as same action',()=>{
 let state=createProblemSolvingSession();
 state=updateProblemSolvingSession(state,{userText:'我刚才断电重新插上并重启过了'});
 state=updateProblemSolvingSession(state,{userText:'restart 我也试过'});
 const power=state.attempts.filter(x=>x.actionId==='power_cycle');
 assert.equal(power.length,1);
});

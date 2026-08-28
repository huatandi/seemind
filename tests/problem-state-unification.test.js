import test from 'node:test';import assert from 'node:assert/strict';
import {deriveBrainWorkingView} from '../core/resolution/problem-state.js';
import {runBrainMainline} from '../core/brain/brain-mainline.js';

test('brain working view is derived from canonical problem session',()=>{
 const session={status:'investigating',goal:'identify_product',symptoms:[{text:'label unclear'}],evidence:[{id:'e1',value:'ABC'}],attempts:[{text:'拍近了'}],attemptResults:[],lifecycle:{generation:2}};
 const view=deriveBrainWorkingView({problemSession:session});
 assert.equal(view.goal,'identify_product');assert.equal(view.lifecycle.generation,2);assert.equal(view.attemptedActions.length,1);
});
test('canonical session overrides stale previous brain lifecycle',()=>{
 const explanation={problemState:{status:'resolved',goal:'done',evidence:[],attempts:[],attemptResults:[],lifecycle:{generation:3}},problem:{},safety:{risk:{level:'LOW'}}};
 const stale={status:'investigating',goal:'stale',unknowns:[{id:'old'}],lifecycle:{status:'investigating',generation:0}};
 const out=runBrainMainline({task:{},observation:{observations:[]},explanation,capabilities:{},previousProblemState:stale});
 assert.equal(out.problemState.goal,'done');assert.equal(out.problemState.lifecycle.status,'resolved');assert.equal(out.problemState.unknowns.length,0);
});

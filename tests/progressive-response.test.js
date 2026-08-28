import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressiveResponse,firstUsefulMessage} from '../core/performance/progressive-response.js';

test('first useful is recorded once and later refinement does not move the timestamp',()=>{
 let t=1000; const p=createProgressiveResponse({startedAt:1000,budget:{firstUsefulMs:800},now:()=>t});
 p.emit('received'); t=1450; const first=p.emit('first_useful',{useful:true}); t=1900; p.emit('refining',{useful:true});
 assert.equal(first.firstUsefulMs,450);assert.equal(p.snapshot().firstUsefulMs,450);assert.equal(first.withinFirstUsefulBudget,true);
});

test('late asynchronous events cannot regress user-visible stage',()=>{
 let t=0;const p=createProgressiveResponse({startedAt:0,now:()=>++t});
 p.emit('first_useful',{useful:true});p.emit('refining');
 assert.equal(p.emit('prepared'),null);assert.equal(p.snapshot().last.stage,'refining');
});

test('first useful wording states only what triage supports',()=>{
 assert.match(firstUsefulMessage({primaryRoute:'document'}),/文字|字段/);
 assert.match(firstUsefulMessage({primaryRoute:'natural',needsOcr:false}),/主要内容/);
});

test('progressive response is presentation-only and carries no answer or route authority',()=>{
 const p=createProgressiveResponse({startedAt:0,now:()=>100});const e=p.emit('first_useful',{useful:true,meta:{route:'document'}});
 assert.equal('answer' in e,false);assert.equal('decision' in e,false);assert.equal('route' in e,false);
});

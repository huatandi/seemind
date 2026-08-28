import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemSolvingSession,updateProblemSolvingSession,planGuidedTroubleshooting} from '../core/resolution/problem-solving-session.js';
import {createProblemState,updateProblemState} from '../core/resolution/problem-state.js';

test('resolved problem stops guided troubleshooting',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{userText:'已经好了，正常了'});
 assert.equal(s.status,'resolved');
 const plan=planGuidedTroubleshooting({state:s,problem:{},resolution:{},helpPath:null});
 assert.equal(plan.nextStep,null);
 assert.equal(plan.lifecycleHold,true);
});

test('resolved problem can reopen when user reports recurrence',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{userText:'已经好了'});
 const resolvedAt=s.lifecycle.resolvedAt;
 s=updateProblemSolvingSession(s,{userText:'现在又坏了，又不行了'});
 assert.equal(s.status,'investigating');
 assert.equal(s.resolution,null);
 assert.equal(s.lifecycle.generation,1);
 assert.ok(s.lifecycle.reopenedAt);
 assert.ok(resolvedAt);
});

test('pause and resume preserve problem history without continuing steps while paused',()=>{
 let s=createProblemSolvingSession({symptoms:[{type:'blink',text:'红灯闪'}]});
 s=updateProblemSolvingSession(s,{userText:'这个先不管，回头再弄'});
 assert.equal(s.status,'paused');
 let plan=planGuidedTroubleshooting({state:s,problem:{},resolution:{},helpPath:null});
 assert.equal(plan.nextStep,null);
 s=updateProblemSolvingSession(s,{userText:'继续处理刚才那个问题'});
 assert.equal(s.status,'investigating');
 assert.equal(s.symptoms.length,1);
});

test('closed problem remains closed until explicit resume',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{userText:'不用处理了，关闭这个问题'});
 assert.equal(s.status,'closed');
 s=updateProblemSolvingSession(s,{userText:'今天天气不错'});
 assert.equal(s.status,'closed');
 s=updateProblemSolvingSession(s,{userText:'继续处理这个问题'});
 assert.equal(s.status,'investigating');
});

test('Brain Problem State mirrors resolved lifecycle and clears next action',()=>{
 let ps=createProblemState({nextBestAction:{kind:'check',text:'do something'},unknowns:[{id:'u1'}]});
 let session=createProblemSolvingSession();
 session=updateProblemSolvingSession(session,{userText:'解决了，已经正常了'});
 ps=updateProblemState(ps,{problemSession:session});
 assert.equal(ps.lifecycle.status,'resolved');
 assert.equal(ps.nextBestAction,null);
 assert.equal(ps.unknowns.length,0);
});

test('reopened generation keeps old attempts as history instead of pretending they never happened',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{userText:'我已经重启过了，还是不行'});
 assert.ok(s.attempts.some(x=>x.actionId==='power_cycle'));
 s=updateProblemSolvingSession(s,{userText:'后来已经好了'});
 s=updateProblemSolvingSession(s,{userText:'今天又坏了'});
 assert.equal(s.status,'investigating');
 assert.equal(s.lifecycle.generation,1);
 assert.ok(s.attempts.some(x=>x.actionId==='power_cycle'));
});

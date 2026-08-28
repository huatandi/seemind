import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemSolvingSession,updateProblemSolvingSession,planGuidedTroubleshooting} from '../core/resolution/problem-solving-session.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

function obs(){
 return {detectedType:'object',extractedText:'ERR 12',confidence:{overall:.8},limitations:[],localResolutionPossible:false,observations:[
  {kind:'general_vision',providerId:'vision',identity:[{label:'device',confidence:.9,status:'observed'}],scene:[],states:[{label:'red_indicator',confidence:.8,status:'observed'}],anomalies:[],regions:[],relationships:[],limitations:[]},
  {kind:'structured_facts',facts:[]},
  {kind:'visual_capability_plan',route:{missingCapabilities:[],needsVisionTeacher:false},providerExecution:{requiredCapabilities:[]}},
 ]};
}

test('problem session accumulates evidence across photos',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{observation:obs()});
 assert.ok(s.evidence.some(x=>x.kind==='visual_identity'));
 assert.ok(s.evidence.some(x=>x.kind==='ocr_text'));
 const count=s.evidence.length;
 s=updateProblemSolvingSession(s,{observation:obs()});
 assert.equal(s.evidence.length,count);
});

test('user attempted actions are remembered',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{userText:'我已经拔过插头，也重启过了，还是不行'});
 assert.ok(s.attempts.length>=1);
 assert.match(s.attempts.map(x=>x.text).join(' '),/拔过插头|重启/);
});

test('resolved user report closes troubleshooting state',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{userText:'现在已经好了，解决了'});
 assert.equal(s.status,'resolved');
 assert.equal(s.resolution.source,'user_report');
});

test('guided planner does not repeat an already attempted exact instruction',()=>{
 let s=createProblemSolvingSession({attempts:[{text:'请检查电源连接',normalized:'请检查电源连接'}]});
 const p=planGuidedTroubleshooting({state:s,problem:{userQuestion:'设备不工作',referencedObjects:[]},resolution:{nextEvidence:[{instruction:'请检查电源连接'}]},helpPath:null});
 assert.notEqual(p.nextStep?.text,'请检查电源连接');
 assert.ok(p.avoidedRepeats>=1);
});

test('image plus voice produces a concrete troubleshooting next step',()=>{
 const e=buildUniversalExplanation({observation:obs(),speechText:'这个红灯一直闪，怎么办？'});
 assert.ok(e.problemState);
 assert.ok(e.troubleshooting);
 assert.ok(e.nextSteps.length>=1);
 assert.match(e.nextSteps[0],/指示灯|拍|确认|错误代码/);
});

test('second turn reuses previous problem state',()=>{
 const first=buildUniversalExplanation({observation:obs(),speechText:'这个红灯一直闪，怎么办？'});
 const second=buildUniversalExplanation({observation:obs(),speechText:'我已经重启过了，还是一样',problemState:first.problemState});
 assert.ok(second.problemState.attempts.some(x=>/重启/.test(x.text)));
 assert.ok(second.problemState.evidence.length>=first.problemState.evidence.length);
});

test('resolved state returns closure instead of more troubleshooting',()=>{
 const first=buildUniversalExplanation({observation:obs(),speechText:'红灯闪'});
 const second=buildUniversalExplanation({observation:obs(),speechText:'现在已经好了，解决了',problemState:first.problemState});
 assert.equal(second.problemState.status,'resolved');
 assert.match(second.nextSteps[0],/问题解决/);
});

test('problem state summary stays compact and excludes internal full observation',()=>{
 const e=buildUniversalExplanation({observation:obs(),speechText:'红灯闪'});
 assert.ok(e.problemStateSummary);
 assert.equal('observations' in e.problemStateSummary,false);
 assert.ok(Array.isArray(e.problemStateSummary.evidence));
});

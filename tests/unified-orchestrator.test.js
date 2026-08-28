import test from 'node:test';
import assert from 'node:assert/strict';
import {orchestrate,routePresentation} from '../core/orchestration/unified-orchestrator.js';

const base={resolution:{decision:'teacher_or_tool',escalation:{needed:true}},retrievalPlan:{localCanAnswer:false,shouldSearch:false},intentPlan:{sequence:['solve']},safety:{risk:{level:'R0'}}};

test('R3 safety overrides search and teacher',()=>{
 const d=orchestrate({explanation:{...base,safety:{risk:{level:'R3'},escalation:{category:'electrician'}}},capabilities:{teacherCount:3,searchAvailable:true}});
 assert.equal(d.route,'HUMAN');
});
test('targeted clarification beats premature external routing',()=>{
 const d=orchestrate({explanation:{...base,resolution:{decision:'need_more_evidence',nextEvidence:[{instruction:'拍铭牌'}]},evidenceRequest:{request:{title:'拍铭牌'}}},capabilities:{teacherCount:2,searchAvailable:true}});
 assert.equal(d.route,'CLARIFY');
});
test('local evidence beats external capability availability',()=>{
 const d=orchestrate({explanation:{...base,resolution:{decision:'local_explain'},retrievalPlan:{localCanAnswer:true,shouldSearch:false}},capabilities:{teacherCount:2,searchAvailable:true}});
 assert.equal(d.route,'LOCAL');
});
test('retrieval is preferred before teacher when useful and available',()=>{
 const d=orchestrate({explanation:{...base,retrievalPlan:{localCanAnswer:false,shouldSearch:true,queries:['q']}},capabilities:{teacherCount:2,searchAvailable:true}});
 assert.equal(d.route,'SEARCH');
});
test('teacher handles unresolved specialist work when retrieval is not next',()=>{
 const d=orchestrate({explanation:base,capabilities:{teacherCount:1,searchAvailable:false}});
 assert.equal(d.route,'TEACHER');
});
test('bounded stop when retrieval required but unavailable and no teacher',()=>{
 const d=orchestrate({explanation:{...base,retrievalPlan:{localCanAnswer:false,shouldSearch:true,needsFreshness:true}},capabilities:{teacherCount:0,searchAvailable:false}});
 assert.equal(d.route,'STOP');
});
test('route presentation is centralized',()=>{
 assert.deepEqual(routePresentation({route:'SEARCH'}),{label:'需要查证',kind:'search',showTeacher:false});
});

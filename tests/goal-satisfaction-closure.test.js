import test from 'node:test';
import assert from 'node:assert/strict';
import {assessGoalSatisfaction} from '../core/evaluation/goal-satisfaction.js';

function graph(nodes,task={}){return {state:'completed',task,nodes:nodes.map(n=>({state:'completed',dependencies:[],metadata:{},evidence:[],...n}))}}

test('completed graph with usable final output can satisfy a simple goal',()=>{
  const g=graph([{id:'final',type:'final_answer',output:{answer:'这是一个杯子'}}],{userIntent:'这是什么'});
  const r=assessGoalSatisfaction({graph:g});
  assert.equal(r.status,'satisfied');assert.equal(r.graphCompleted,true);
});

test('graph completion is only partial when current-price freshness is unsupported',()=>{
  const g=graph([
    {id:'search',type:'retrieve_evidence',metadata:{freshness:'FAST_CHANGING'},output:null},
    {id:'final',type:'final_answer',output:{answer:'价格可能是 10'}}
  ],{userIntent:'现在多少钱',requiredCapabilities:['search','retrieve_current_info']});
  const r=assessGoalSatisfaction({graph:g});
  assert.equal(r.status,'partial');assert.ok(r.gaps.includes('freshness_evidence_missing'));
});

test('unresolved source conflict prevents false solved status even with final prose',()=>{
  const g=graph([{id:'final',type:'final_answer',output:{answer:'A 更好'}}],{userIntent:'比较 A 和 B'});
  const r=assessGoalSatisfaction({graph:g,context:{warnings:['SOURCE_CONFLICT_UNRESOLVED']}});
  assert.equal(r.status,'partial');assert.ok(r.gaps.includes('unresolved_evidence_or_conflict'));
});

test('identity-dependent goal remains partial when identity was not actually resolved',()=>{
  const g=graph([
    {id:'identify',type:'identify_entity',output:null},
    {id:'final',type:'final_answer',output:{answer:'候选型号'}}
  ],{userIntent:'这是什么具体型号',requiredCapabilities:['identify']});
  const r=assessGoalSatisfaction({graph:g});
  assert.equal(r.status,'partial');assert.ok(r.gaps.includes('identity_not_resolved'));
});

test('missing final result is unsatisfied rather than completed equals solved',()=>{
  const g=graph([{id:'read',type:'capability_step',output:{text:'hola'}}],{userIntent:'翻译这个'});
  const r=assessGoalSatisfaction({graph:g});
  assert.equal(r.status,'unsatisfied');assert.ok(r.gaps.includes('usable_final_result_missing'));
});

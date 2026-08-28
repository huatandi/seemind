import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskGraph} from '../core/planning/task-graph.js';
import {prepareGapDirectedRecovery} from '../core/planning/gap-directed-recovery.js';

function execution(nodes,gaps,status='partial'){
  const graph=createTaskGraph({task:{id:'t',type:'mixed'},nodes});graph.state='completed';
  for(const n of graph.nodes){n.state='completed';n.output={ok:n.id};n.evidence=[{from:n.id}]}
  const receipts=Object.fromEntries(graph.nodes.map(n=>[n.id,{status:'completed',output:n.output}]));
  return {graph,context:{result:{done:true},goalSatisfaction:{status,gaps},recovery:{},trace:[]},nodeReceipts:receipts};
}
const n=(id,type,deps=[],metadata={})=>({id,type,dependencies:deps,metadata});

test('freshness gap reopens only fresh retrieval and descendants, preserving OCR/translation',()=>{
  const ex=execution([
    n('read','capability_step'),n('translate','capability_step',['read']),n('identify','identify_entity'),
    n('search','retrieve_evidence',['identify'],{freshness:'FAST_CHANGING'}),n('compare','compare_options',['search','translate']),n('final','final_answer',['compare'])
  ],['freshness_evidence_missing']);
  const r=prepareGapDirectedRecovery(ex);
  assert.deepEqual(r.reopened,['search','compare','final']);
  assert.equal(ex.graph.nodes.find(x=>x.id==='read').state,'completed');
  assert.equal(ex.graph.nodes.find(x=>x.id==='translate').state,'completed');
  assert.equal(ex.graph.nodes.find(x=>x.id==='identify').state,'completed');
  assert.equal(ex.graph.nodes.find(x=>x.id==='search').state,'pending');
  assert.ok(ex.nodeReceipts.read);assert.equal(ex.nodeReceipts.search,undefined);
});

test('identity gap reopens identify and identity-dependent descendants but not independent text branch',()=>{
  const ex=execution([
    n('read','capability_step'),n('translate','capability_step',['read']),n('identify','identify_entity'),
    n('search','retrieve_evidence',['identify']),n('final','final_answer',['translate','search'])
  ],['identity_not_resolved']);
  const r=prepareGapDirectedRecovery(ex);
  assert.deepEqual(r.reopened,['identify','search','final']);
  assert.equal(ex.graph.nodes.find(x=>x.id==='translate').state,'completed');
});

test('comparison gap reopens comparison and final only',()=>{
  const ex=execution([n('identify','identify_entity'),n('search','retrieve_evidence',['identify']),n('compare','compare_options',['search']),n('final','final_answer',['compare'])],['requested_comparison_not_completed']);
  const r=prepareGapDirectedRecovery(ex);
  assert.deepEqual(r.reopened,['compare','final']);
  assert.equal(ex.graph.nodes.find(x=>x.id==='search').state,'completed');
});

test('blocked closure does not silently replan around missing user evidence',()=>{
  const ex=execution([n('identify','identify_entity'),n('final','final_answer',['identify'])],['workflow_blocked'],'blocked');
  const r=prepareGapDirectedRecovery(ex);
  assert.equal(r.changed,false);assert.equal(r.reason,'USER_OR_EVIDENCE_INPUT_REQUIRED');
  assert.equal(ex.graph.state,'completed');
});

test('unknown gap does not restart the whole graph',()=>{
  const ex=execution([n('a','capability_step'),n('final','final_answer',['a'])],['unknown_future_gap']);
  const r=prepareGapDirectedRecovery(ex);
  assert.equal(r.changed,false);assert.equal(r.reason,'NO_EXISTING_GRAPH_NODE_CAN_CLOSE_GAP');
  assert.ok(ex.graph.nodes.every(x=>x.state==='completed'));
});

test('recovery preserves lifetime graph counters instead of hiding prior cost',()=>{
  const ex=execution([n('search','retrieve_evidence',[],{freshness:'FAST_CHANGING'}),n('final','final_answer',['search'])],['freshness_evidence_missing']);
  ex.graph.counters={steps:7,failures:1,retries:2};
  prepareGapDirectedRecovery(ex);
  assert.deepEqual(ex.graph.counters,{steps:7,failures:1,retries:2});
});

test('satisfied goal is a no-op',()=>{
  const ex=execution([n('final','final_answer')],[],'satisfied');
  const r=prepareGapDirectedRecovery(ex);
  assert.equal(r.changed,false);assert.equal(r.reason,'NO_OPEN_GOAL_GAP');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceGraph,buildCurrentEntityFacts,reconcileEntityFact} from '../core/evidence/evidence-graph.js';
import {withEvidenceSemantics} from '../core/evidence/evidence-semantics.js';
import {createConversationSession,attachFactSnapshot} from '../core/session/conversation-session.js';

function claim(id,value,at,state='active'){
  const x=withEvidenceSemantics({id,entityId:'e1',type:'state',value,source:'photo',confidence:.9},{
    evidenceKind:'observation',observedAt:at,assertedAt:at,confidence:.9
  });
  x.semantics.lifecycleState=state;
  return x;
}

test('newer active fact becomes current while superseded history remains auditable',()=>{
  const g=createEvidenceGraph({activeEntityId:'e1',claims:[
    claim('old','green','2026-08-25T10:00:00.000Z','superseded'),
    claim('new','red','2026-08-26T10:00:00.000Z'),
  ]});
  const v=buildCurrentEntityFacts(g,'e1',{now:'2026-08-26T12:00:00.000Z'});
  assert.equal(v.current.state.value,'red');
  assert.equal(v.history.state.length,2);
  assert.equal(v.history.state.find(x=>x.claimId==='old').usable,false);
});

test('superseded old fact cannot resurrect merely because conversation continues',()=>{
  const g=createEvidenceGraph({activeEntityId:'e1',claims:[
    claim('old','A','2026-08-20T10:00:00.000Z','superseded'),
    claim('new','B','2026-08-26T10:00:00.000Z'),
  ]});
  const first=buildCurrentEntityFacts(g,'e1',{now:'2026-08-26T12:00:00.000Z'});
  const later=buildCurrentEntityFacts(g,'e1',{now:'2026-08-26T20:00:00.000Z'});
  assert.equal(first.current.state.value,'B');
  assert.equal(later.current.state.value,'B');
});

test('reconcile preserves old contradictory fact as superseded instead of overwriting it',()=>{
  let g=createEvidenceGraph({activeEntityId:'e1',claims:[claim('old','green','2026-08-25T10:00:00.000Z')]});
  const r=reconcileEntityFact(g,{entityId:'e1',type:'state',value:'red',source:'user',timestamp:'2026-08-26T10:00:00.000Z'});
  assert.deepEqual(r.superseded,['old']);
  assert.equal(r.graph.claims.find(x=>x.id==='old').semantics.lifecycleState,'superseded');
  assert.equal(buildCurrentEntityFacts(r.graph,'e1',{now:'2026-08-26T11:00:00.000Z'}).current.state.value,'red');
});

test('simultaneous contradictory active facts are conflict, not an arbitrary winner',()=>{
  const g=createEvidenceGraph({activeEntityId:'e1',claims:[
    claim('a','open','2026-08-26T10:00:00.000Z'),
    claim('b','closed','2026-08-26T10:00:00.500Z'),
  ]});
  const v=buildCurrentEntityFacts(g,'e1',{now:'2026-08-26T11:00:00.000Z'});
  assert.equal(v.current.state,null);
  assert.equal(v.conflicts[0].reason,'CONCURRENT_ACTIVE_FACT_CONFLICT');
});

test('conversation session stores only a derived fact snapshot, not a second fact database',()=>{
  const g=createEvidenceGraph({activeEntityId:'e1',claims:[claim('new','red','2026-08-26T10:00:00.000Z')]});
  const snapshot=buildCurrentEntityFacts(g,'e1',{now:'2026-08-26T11:00:00.000Z'});
  const s=attachFactSnapshot(createConversationSession({id:'s1'}),snapshot);
  assert.equal(s.factSnapshot.current.state.value,'red');
  assert.equal(Array.isArray(s.factSnapshot.history.state),true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {withEvidenceSemantics} from '../core/evidence/evidence-semantics.js';
import {buildEvidenceAnswerContract,renderEvidenceAnswer} from '../core/answer/evidence-answer-contract.js';
import {normalizeAnswerContract} from '../core/answer/answer-contract.js';

function ev(id,kind,state='active'){
  const x=withEvidenceSemantics({id,confidence:.9,source:kind==='user_report'?'user':'photo'},{evidenceKind:kind,observedAt:'2026-08-26T10:00:00.000Z',confidence:.9});
  x.semantics.lifecycleState=state; return x;
}

test('final answer separates user report from confirmed fact',()=>{
  const e=ev('u1','user_report');
  const c=buildEvidenceAnswerContract({answer:{claims:[{id:'c1',text:'用户说价格是99',type:'fact',status:'supported',confidence:.8,evidenceRefs:['u1']}]},evidence:[e],verification:{accepted:true}});
  assert.equal(c.userReports.length,1);
  assert.equal(c.currentFacts.length,0);
});

test('superseded evidence never appears as a current final-answer fact',()=>{
  const old=ev('old','observation','superseded');
  const c=buildEvidenceAnswerContract({answer:{claims:[{id:'c1',text:'旧状态A',type:'fact',status:'supported',confidence:.9,evidenceRefs:['old']}]},evidence:[old],verification:{accepted:true}});
  assert.equal(c.currentFacts.length,1, 'claim remains visible for audit but has no live refs');
  assert.deepEqual(c.currentFacts[0].evidenceRefs,[]);
  assert.equal(c.provenance.length,0);
});

test('historical superseded fact is labeled history, not merged into current facts',()=>{
  const c=buildEvidenceAnswerContract({answer:{claims:[]},factView:{history:{price:[{claimId:'p1',value:'99',source:'search',usable:false,reasons:['lifecycle_superseded'],semantics:{lifecycleState:'superseded'}}]},conflicts:[]},verification:{accepted:true}});
  assert.equal(c.historicalFacts[0].value,'99');
  assert.match(renderEvidenceAnswer(c),/历史信息/);
});

test('verification conflicts remain visible and prevent resolved-fact presentation',()=>{
  const c=buildEvidenceAnswerContract({answer:{claims:[]},verification:{accepted:false,issues:['source_conflict:c1','consensus_unresolved:c1']}});
  assert.equal(c.canStateAsResolvedFact,false);
  assert.ok(c.conflicts.length>=2);
  assert.match(renderEvidenceAnswer(c),/存在冲突/);
});

test('answer contract preserves optional epistemic and temporal metadata',()=>{
  const a=normalizeAnswerContract({answer:'x',claims:[{id:'c',text:'x',type:'fact',status:'supported',confidence:.9,evidenceRefs:['e'],evidenceKind:'observation',temporalStatus:'current',observedAt:'2026-08-26'}],epistemic:{currentFacts:[{id:'c'}]}});
  assert.equal(a.claims[0].evidenceKind,'observation');
  assert.equal(a.claims[0].temporalStatus,'current');
  assert.equal(a.epistemic.currentFacts.length,1);
});

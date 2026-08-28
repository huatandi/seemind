import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvidenceSemantics,assessEvidenceUsability,supersedeEvidence,withEvidenceSemantics} from '../core/evidence/evidence-semantics.js';
import {createEvidenceGraph,addPhotoEvidence} from '../core/evidence/evidence-graph.js';
import {judgeClaims} from '../core/evidence/claim-judge.js';

test('user report and direct observation remain different evidence kinds',()=>{
  const user=normalizeEvidenceSemantics({source:'user',confidence:.8});
  const seen=normalizeEvidenceSemantics({source:'photo',photoId:'p1',confidence:.9});
  assert.equal(user.evidenceKind,'user_report');
  assert.equal(seen.evidenceKind,'observation');
});

test('photo claims preserve observation time and observation semantics',()=>{
  const observation={id:'obs1',extractedText:'MODEL: ABC123',observations:[]};
  const {graph}=addPhotoEvidence(createEvidenceGraph(),{observation,timestamp:'2026-08-26T10:00:00.000Z'});
  const model=graph.claims.find(x=>x.type==='model');
  assert.equal(model.semantics.evidenceKind,'observation');
  assert.equal(model.semantics.observedAt,'2026-08-26T10:00:00.000Z');
});

test('expired evidence is not usable even when confidence is high',()=>{
  const e=withEvidenceSemantics({id:'e1',confidence:.99},{evidenceKind:'external_source',validUntil:'2026-01-01T00:00:00.000Z'});
  const a=assessEvidenceUsability(e,{now:'2026-08-26T00:00:00.000Z'});
  assert.equal(a.usable,false);
  assert.ok(a.reasons.includes('validity_expired'));
});

test('superseding evidence preserves history instead of overwriting it',()=>{
  const old=withEvidenceSemantics({id:'old',value:'A'},{evidenceKind:'observation'});
  const {previous,replacement}=supersedeEvidence(old,{id:'new',value:'B'},{evidenceKind:'observation'});
  assert.equal(previous.semantics.lifecycleState,'superseded');
  assert.equal(replacement.semantics.supersedes,'old');
  assert.equal(previous.value,'A');
  assert.equal(replacement.value,'B');
});

test('claim judge refuses a superseded evidence reference',()=>{
  const old=withEvidenceSemantics({id:'e1',type:'search',claimKey:'price',claimValue:10},{evidenceKind:'external_source'});
  old.semantics.lifecycleState='superseded';
  const result=judgeClaims({claims:[{id:'c1',type:'price',status:'supported',evidenceRefs:['e1']}]},{
    evidence:[old],contract:{requireClaims:true},task:{userIntent:'price'}
  });
  assert.equal(result.ok,false);
  assert.ok(result.issues.includes('inactive_evidence_ref:c1'));
  assert.equal(result.claims[0].evidenceRefs.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceAuthorityForClaim,rankEvidenceAuthority} from '../core/evidence/task-aware-authority.js';

test('product model identity trusts barcode and label OCR over general vision',()=>{
 const ranked=rankEvidenceAuthority([{id:'v',source:'vision'},{id:'o',source:'ocr'},{id:'b',source:'barcode'}],{field:'model'},{});
 assert.deepEqual(ranked.map(x=>x.id),['b','o','v']);
});

test('current price prefers current retailer evidence rather than local visual guess or Teacher prose',()=>{
 const ranked=rankEvidenceAuthority([{id:'vision',source:'vision'},{id:'teacher',source:'teacher'},{id:'store',sourceType:'retailer'}],{field:'price'},{type:'current_price'});
 assert.equal(ranked[0].id,'store');
 assert.ok(ranked[0].taskAuthority.authority>ranked.find(x=>x.id==='teacher').taskAuthority.authority);
});

test('receipt total gives arithmetic and OCR claim-specific authority instead of a universal source hierarchy',()=>{
 const a=evidenceAuthorityForClaim({source:'arithmetic'},{field:'receipt_total'});
 const o=evidenceAuthorityForClaim({source:'ocr'},{field:'receipt_total'});
 const v=evidenceAuthorityForClaim({source:'vision'},{field:'receipt_total'});
 assert.ok(a.authority>o.authority && o.authority>v.authority);
});

test('Teacher is explicitly a specialist candidate and never a universal evidence winner',()=>{
 const x=evidenceAuthorityForClaim({source:'teacher'},{field:'model'});
 assert.equal(x.policy.teacherIsNotDefaultAuthority,true);
 assert.equal(x.policy.noUniversalEvidenceWinner,true);
 assert.ok(x.authority<evidenceAuthorityForClaim({source:'barcode'},{field:'model'}).authority);
});

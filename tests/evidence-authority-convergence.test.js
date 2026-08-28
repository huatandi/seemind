import test from 'node:test';import assert from 'node:assert/strict';
import {judgeClaims} from '../core/evidence/claim-judge.js';
import {verifyExecutionResult} from '../core/verification/verification-core.js';

test('claim judging uses task-aware authority but does not become a second final verdict authority',()=>{
 const evidence=[
  {id:'ocr',source:'ocr',claimKey:'model',claimValue:'ZX-500',confidence:.9},
  {id:'vision',source:'vision',claimKey:'model',claimValue:'ZX-500',confidence:.9},
 ];
 const answer={claims:[{id:'c1',type:'fact',field:'model',value:'ZX-500',status:'supported',evidenceRefs:['vision','ocr']}]};
 const judged=judgeClaims(answer,{task:{type:'product_identity'},evidence});
 assert.equal(judged.ok,true);
 assert.equal(judged.claims[0].authority.strongestSourceId,'ocr');
 assert.ok(judged.claims[0].authority.strongestAuthority>0);
});

test('verification core remains the sole acceptance authority while exposing evidence-authority metadata',()=>{
 const envelope={status:'completed',route:'LOCAL',requiresVerification:true,result:{answer:{claims:[{id:'c1',type:'fact',field:'model',value:'ZX-500',status:'supported',evidenceRefs:['ocr']}]}}};
 const taskPackage={task:{type:'product_identity'},evidence:[{id:'ocr',source:'ocr',claimKey:'model',claimValue:'ZX-500',confidence:.95}]};
 const verdict=verifyExecutionResult({envelope,taskPackage});
 assert.equal(verdict.authority,'verification_core');
 assert.equal(verdict.evidenceSummary.decisionAuthority,'verification_core');
 assert.equal(verdict.evidenceSummary.taskAwareEvidenceAuthority,true);
});

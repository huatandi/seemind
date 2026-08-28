import test from 'node:test';
import assert from 'node:assert/strict';
import {planVisionFailureRecovery} from '../core/vision/vision-failure-recovery.js';
import {planResolution} from '../core/resolution/resolution-router.js';

test('blur prefers bounded cheap recovery and recapture before Teacher',()=>{
 const x=planVisionFailureRecovery({quality:{score:.42,flags:['blurry_or_low_detail']},attempts:0,userCanRecapture:true});
 assert.equal(x.shouldEscalate,false);
 assert.equal(x.nextAction.type,'LOCAL_ENHANCE');
 assert.ok(x.actions.some(a=>a.type==='RECAPTURE'));
 assert.equal(x.actions.some(a=>a.type==='TEACHER'),false);
});

test('glare asks for angle change rather than pretending a larger model fixes the pixels',()=>{
 const x=planVisionFailureRecovery({quality:{score:.4,flags:['overexposed','highlight_clipping']},attempts:0});
 assert.ok(x.actions.some(a=>a.type==='RECAPTURE'&&/反光|强光/.test(a.instruction)));
});

test('specific identity gap prefers crop/region evidence',()=>{
 const x=planVisionFailureRecovery({quality:{score:.8,flags:[]},missingCapabilities:['specific_identity'],attempts:0});
 assert.equal(x.nextAction.type,'CROP_OR_REGION');
 assert.equal(x.nextAction.target,'label_or_nameplate');
});

test('bounded repeated failure escalates with minimum necessary Teacher policy',()=>{
 const x=planVisionFailureRecovery({quality:{score:.3,flags:['blurry_or_low_detail']},attempts:2,userCanRecapture:true});
 assert.equal(x.shouldEscalate,true);
 assert.ok(x.actions.some(a=>a.type==='TEACHER'&&a.sendPolicy==='minimum_necessary'));
});

test('resolution mainline exposes visual recovery and requests better capture first',()=>{
 const r=planResolution({
   observation:{confidence:{overall:.4},imageQuality:{score:.35,flags:['blurry_or_low_detail']}},
   problem:{detectedType:'unknown',intentHypotheses:[{intent:'identify_and_explain'}]},
   context:{visualRecoveryAttempts:0,userCanRecapture:true}
 });
 assert.equal(r.decision,'need_more_evidence');
 assert.equal(r.visualRecovery.needed,true);
 assert.match(r.nextEvidence[0].instruction,/稳住手机|靠近/);
 assert.ok(r.reasons.includes('recoverable_visual_failure'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {understandProblem} from '../core/resolution/problem-understanding.js';
import {planResolution,recommendHelpPath} from '../core/resolution/resolution-router.js';

function obs(overrides={}){
 return {
  detectedType:'unknown',confidence:{overall:.4},limitations:[],localResolutionPossible:false,
  observations:[{kind:'structured_facts',facts:[]}],...overrides
 };
}
test('unknown weak image asks for targeted next photos instead of guessing',()=>{
 const o=obs();
 const p=understandProblem(o,{});
 const r=planResolution({observation:o,problem:p});
 assert.equal(r.decision,'need_more_evidence');
 assert.equal(r.canOfferSolutionNow,false);
 assert.ok(r.nextEvidence.some(x=>/完整物体/.test(x.instruction)));
 assert.ok(r.nextEvidence.some(x=>/铭牌|型号/.test(x.instruction)));
});
test('explicit troubleshooting intent is recognized',()=>{
 const o=obs({detectedType:'appliance',confidence:{overall:.7},limitations:['cause unknown']});
 const p=understandProblem(o,{userQuestion:'这个机器坏了，怎么修？'});
 assert.equal(p.intentHypotheses[0].intent,'troubleshoot');
 const r=planResolution({observation:o,problem:p});
 assert.equal(r.decision,'teacher_or_tool');
 assert.ok(r.escalation.preferredKinds.includes('troubleshooting'));
});
test('recognized reliable local evidence can be explained locally',()=>{
 const o=obs({detectedType:'retail_receipt',confidence:{overall:.91},localResolutionPossible:true,
  observations:[{kind:'structured_facts',facts:[{id:'money.total',name:'total',category:'money',value:10000,unit:'MXN-centavo',confidence:.95,status:'resolved',conflicts:[]}]}]});
 const p=understandProblem(o,{userQuestion:'这是什么？'});
 const r=planResolution({observation:o,problem:p});
 assert.equal(r.decision,'local_explain');
 assert.equal(r.canExplainNow,true);
 assert.equal(r.escalation.needed,false);
});
test('conflicting facts prefer evidence collection before escalation',()=>{
 const o=obs({detectedType:'receipt',confidence:{overall:.8},observations:[{kind:'structured_facts',facts:[
  {id:'money.total',name:'total',category:'money',value:12000,confidence:.9,status:'resolved',conflicts:[{id:'subtotal-tax-total'}]}
 ]}]});
 const p=understandProblem(o,{});
 const r=planResolution({observation:o,problem:p});
 assert.equal(r.decision,'need_more_evidence');
 assert.equal(r.reasons[0],'conflicting_evidence');
});
test('escalation follows minimum necessary data policy',()=>{
 const o=obs({detectedType:'appliance',confidence:{overall:.65},limitations:['need diagnosis']});
 const p=understandProblem(o,{userQuestion:'怎么办？'});
 const r=planResolution({observation:o,problem:p});
 assert.equal(r.escalation.needed,true);
 assert.equal(r.escalation.sendPolicy,'minimum_necessary');
 assert.equal(r.escalation.sendStructuredFacts,true);
 assert.equal(r.escalation.sendOriginalImage,false);
});
test('unknown visual escalation may request original image for vision Teacher',()=>{
 const o=obs();
 const p=understandProblem(o,{userQuestion:'这是什么？'});
 const r=planResolution({observation:o,problem:p});
 assert.equal(r.escalation.needed,true);
 assert.equal(r.escalation.sendOriginalImage,true);
 assert.ok(r.escalation.preferredKinds.includes('vision'));
});
test('freshness requirement adds web-search capability',()=>{
 const o=obs({detectedType:'product',confidence:{overall:.7},limitations:['current info unavailable']});
 const p=understandProblem(o,{userQuestion:'现在多少钱？'});
 const r=planResolution({observation:o,problem:p,context:{freshnessRequired:true}});
 assert.ok(r.escalation.preferredKinds.includes('web_search'));
});
test('when no Teacher exists the system still recommends a useful help path',()=>{
 const o=obs({detectedType:'appliance',limitations:['unknown failure']});
 const p=understandProblem(o,{userQuestion:'坏了怎么修？'});
 const r=planResolution({observation:o,problem:p});
 const help=recommendHelpPath({problem:p,resolution:r,availableTeachers:[]});
 assert.equal(help.kind,'human_or_specialist_tool');
 assert.match(help.message,/manual|diagnostic|technician/i);
});
test('available Teacher is preferred for unresolved subproblem',()=>{
 const o=obs({detectedType:'object',limitations:['need expert']});
 const p=understandProblem(o,{userQuestion:'如何解决？'});
 const r=planResolution({observation:o,problem:p});
 const help=recommendHelpPath({problem:p,resolution:r,availableTeachers:['vision-expert']});
 assert.equal(help.kind,'teacher');
 assert.deepEqual(help.candidates,['vision-expert']);
});
test('problem model separates known and unknown facts',()=>{
 const o=obs({observations:[{kind:'structured_facts',facts:[
  {id:'identity.brand',name:'brand',category:'identity',value:'ABC',confidence:.9,status:'resolved',conflicts:[]},
  {id:'domain.model',name:'model',category:'domain',value:null,confidence:0,status:'unresolved',conflicts:[]},
 ]}]});
 const p=understandProblem(o,{});
 assert.equal(p.knownFacts[0].id,'identity.brand');
 assert.equal(p.unknownFacts[0].id,'domain.model');
});

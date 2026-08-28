import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRealWorldRisk,enforceSafety,commercialHandoff} from '../core/safety/real-world-safety-kernel.js';
import {buildUniversalExplanation,renderUniversalExplanationHtml} from '../core/explanation/universal-explainer.js';

function problem(q){return {userQuestion:q,symptoms:[],intentHypotheses:[],referencedObjects:[]}}
function obs(text='',label='object'){return {detectedType:'object',extractedText:text,confidence:{overall:.8},limitations:[],localResolutionPossible:false,observations:[
 {kind:'general_vision',providerId:'v',identity:[{label,confidence:.9,status:'observed'}],scene:[],states:[],anomalies:[],regions:[],relationships:[],limitations:[]},
 {kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}
]}}

test('ordinary image explanation remains R0',()=>{
 const r=assessRealWorldRisk({observation:obs(),problem:problem('这是什么？'),worldDomain:{primary:'general'}});
 assert.equal(r.level,'R0');assert.equal(r.allowedInstructionLevel,'normal');
});
test('exposed electrical hazard becomes R3 protective-only',()=>{
 const r=assessRealWorldRisk({observation:obs(),problem:problem('配电箱里有裸露电线，我能碰一下看看吗？'),worldDomain:{primary:'repair'}});
 assert.equal(r.level,'R3');assert.ok(r.hazards.includes('electrical'));assert.equal(r.allowedInstructionLevel,'protective_only');
});
test('R3 filters dangerous action and replaces it with protective guidance',()=>{
 const risk=assessRealWorldRisk({problem:problem('裸露电线'),worldDomain:{primary:'repair'}});
 const safe=enforceSafety({risk,problem:problem('裸露电线'),worldDomain:{primary:'repair'},explanation:{nextSteps:['打开配电箱并触碰这根线确认温度。']}});
 assert.equal(safe.safety.blockedActions.length,1);assert.match(safe.nextSteps[0],/不要触碰|合格电工/);
});
test('gas/fire hazard escalates without speculative repair steps',()=>{
 const e=buildUniversalExplanation({observation:obs(''),textInput:'这里有燃气味还有冒烟，我应该拆开看看吗？'});
 assert.equal(e.safety.risk.level,'R3');assert.match(e.nextSteps.join(' '),/远离|紧急服务|专业人员/);assert.doesNotMatch(e.nextSteps.join(' '),/拆开看看/);
});
test('medication decision is at least R2',()=>{
 const r=assessRealWorldRisk({problem:problem('这个药我可以加倍剂量吗？'),worldDomain:{primary:'general'}});
 assert.ok(r.score>=2);assert.ok(r.hazards.includes('medical'));
});
test('food ingestion uncertainty is R2, not confident permission to eat',()=>{
 const r=assessRealWorldRisk({problem:problem('这个野外捡到的东西能不能吃？'),worldDomain:{primary:'food'}});
 assert.equal(r.level,'R2');
});
test('chemical mixing becomes R3',()=>{
 const r=assessRealWorldRisk({problem:problem('漂白水和氨水可以混合吗？'),worldDomain:{primary:'general'}});
 assert.equal(r.level,'R3');assert.ok(r.hazards.includes('chemical'));
});
test('commercial handoff only occurs after escalation category is locked',()=>{
 const risk=assessRealWorldRisk({problem:problem('裸露电线'),worldDomain:{primary:'repair'}});
 const safe=enforceSafety({risk,problem:problem('裸露电线'),worldDomain:{primary:'repair'},explanation:{nextSteps:[]}});
 const handoff=commercialHandoff(safe);
 assert.equal(handoff.decisionLocked,true);assert.equal(handoff.serviceCategory,'electrician');assert.equal(handoff.sponsoredRankingMayChangeSafetyDecision,false);
});
test('low risk has no commercial expert handoff',()=>{
 const risk=assessRealWorldRisk({problem:problem('这是什么花？'),worldDomain:{primary:'plant'}});
 const safe=enforceSafety({risk,problem:problem('这是什么花？'),worldDomain:{primary:'plant'},explanation:{nextSteps:['拍一下花朵。']}});
 assert.equal(commercialHandoff(safe),null);
});
test('universal explainer always returns a safety decision',()=>{
 const e=buildUniversalExplanation({observation:obs('', 'plant'),textInput:'这是什么植物？'});
 assert.ok(e.safety?.risk?.level);assert.ok(e.safetyAudit);
});
test('R3 universal explanation produces locked service category handoff',()=>{
 const e=buildUniversalExplanation({observation:obs('', 'device'),textInput:'配电箱裸露电线，我要剪掉它吗？'});
 assert.equal(e.safety.risk.level,'R3');assert.equal(e.commercialHandoff?.decisionLocked,true);assert.equal(e.commercialHandoff?.serviceCategory,'electrician');
});
test('R2/R3 safety notice renders to user and escapes content',()=>{
 const e=buildUniversalExplanation({observation:obs('', 'device'),textInput:'配电箱裸露电线，可以触碰吗？'});
 const html=renderUniversalExplanationHtml(e);
 assert.match(html,/安全提示 · R3/);assert.doesNotMatch(html,/<script>/);
});
test('safety audit avoids raw observation graph/media payload',()=>{
 const e=buildUniversalExplanation({observation:obs('MODEL X'),textInput:'配电箱裸露电线'});
 assert.equal('observation' in e.safetyAudit,false);assert.equal('problemState' in e.safetyAudit,false);assert.equal(e.safetyAudit.riskLevel,'R3');
});

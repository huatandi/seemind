import test from 'node:test';
import assert from 'node:assert/strict';
import {understandUniversalIntent,planIntentResponse} from '../core/intent/universal-intent-router.js';
import {buildSpecialistHandoff,buildReferralPresentation} from '../core/intent/specialist-handoff.js';
import {buildUniversalExplanation,renderUniversalExplanationHtml} from '../core/explanation/universal-explainer.js';

const ig=(q)=>understandUniversalIntent({text:q,worldDomain:{primary:'general'}});
test('compound identify+safety+solve intent is preserved',()=>{
 const x=ig('这是什么虫？有毒危险吗？我该怎么办？');
 const a=x.intents.map(v=>v.intent);assert.ok(a.includes('identify'));assert.ok(a.includes('safety'));assert.ok(a.includes('solve'));assert.equal(x.compound,true);
});
test('translate intent is distinct from reading text',()=>{assert.equal(ig('帮我翻译这里写的内容').primary,'translate')});
test('compare intent is understood',()=>{assert.equal(ig('这个和刚才那个哪个好，有什么区别？').primary,'compare')});
test('find intent requests external routing',()=>{
 const x=ig('哪里可以买到这个？给我链接');const p=planIntentResponse({intentGraph:x,worldDomain:{primary:'product'}});
 assert.equal(p.shouldRouteExternally,true);assert.equal(p.externalRouteReason,'user_requested_external_resource');
});
test('explicit request for another AI routes to specialist',()=>{
 const x=ig('这个问题应该交给哪个AI？');const p=planIntentResponse({intentGraph:x,worldDomain:{primary:'general'}});
 assert.ok(x.intents.some(v=>v.intent==='route_to_specialist'));assert.equal(p.shouldRouteExternally,true);
});
test('handoff packages question and minimum necessary evidence',()=>{
 const x=ig('这个植物交给哪个AI识别？');const p=planIntentResponse({intentGraph:x,worldDomain:{primary:'plant'}});
 const h=buildSpecialistHandoff({intentPlan:p,intentGraph:x,worldDomain:{primary:'plant'},problem:{userQuestion:x.userText,knownFacts:[{text:'叶片有黄斑'}]},observation:{extractedText:''},safety:{}});
 assert.equal(h.needed,true);assert.equal(h.evidencePackage.minimumNecessary,true);assert.match(h.preparedPrompt,/叶片有黄斑/);
});
test('handoff requires attribution and identifies SeeMind as orchestrator',()=>{
 const x=ig('找什么专家看这个？');const p=planIntentResponse({intentGraph:x,worldDomain:{primary:'vehicle'}});
 const h=buildSpecialistHandoff({intentPlan:p,intentGraph:x,worldDomain:{primary:'vehicle'},problem:{userQuestion:x.userText},observation:{},safety:{}});
 assert.equal(h.attributionRequired,true);assert.equal(h.seeMindRole,'orchestrator');assert.equal(h.specialistRole,'analysis_or_execution');
});
test('referral presentation explicitly avoids stealing specialist credit',()=>{
 const r=buildReferralPresentation({needed:true,category:'plant_ai',evidencePackage:{},preparedPrompt:'x'});
 assert.match(r.attribution,/不冒充|来源/);
});
test('no specialist handoff is manufactured when not needed',()=>{
 const x=ig('这是什么？');const p=planIntentResponse({intentGraph:x,worldDomain:{primary:'general'}});
 assert.equal(buildSpecialistHandoff({intentPlan:p,intentGraph:x,worldDomain:{primary:'general'},problem:{},observation:{},safety:{}}),null);
});
test('safety escalation can trigger handoff even without user asking for specialist',()=>{
 const x=ig('怎么办');const p=planIntentResponse({intentGraph:x,worldDomain:{primary:'repair'}});
 const h=buildSpecialistHandoff({intentPlan:p,intentGraph:x,worldDomain:{primary:'repair'},problem:{userQuestion:'怎么办'},observation:{},safety:{escalation:{needed:true,category:'electrician'}}});
 assert.equal(h.category,'electrician');assert.equal(h.reason,'safety_escalation');
});
test('universal explanation exposes intent graph',()=>{
 const o={detectedType:'object',extractedText:'',confidence:{overall:.8},limitations:[],localResolutionPossible:true,observations:[]};
 const e=buildUniversalExplanation({observation:o,textInput:'这是什么？怎么用？'});
 assert.ok(e.intentGraph.intents.some(x=>x.intent==='identify'));assert.ok(e.intentGraph.intents.some(x=>x.intent==='how_to_use'));
});
test('universal explanation can render specialist referral',()=>{
 const o={detectedType:'object',extractedText:'',confidence:{overall:.8},limitations:[],localResolutionPossible:true,observations:[]};
 const e=buildUniversalExplanation({observation:o,textInput:'这个问题应该交给哪个AI？'});
 assert.ok(e.specialistHandoff);assert.match(renderUniversalExplanationHtml(e),/交给更合适的 AI/);
});

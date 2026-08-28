import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyWorldDomain,buildUniversalEvidenceStrategy} from '../core/world/universal-world-router.js';
import {analyzeEvidenceGaps,directEvidenceRequest} from '../core/resolution/evidence-request-intelligence.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

function obs(text='',label='object',type='object'){
 return {detectedType:type,extractedText:text,confidence:{overall:.8},limitations:[],localResolutionPossible:false,observations:[
  {kind:'general_vision',providerId:'v',identity:[{label,confidence:.9,status:'observed'}],scene:[],states:[],anomalies:[],regions:[],relationships:[],limitations:[]},
  {kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}
 ]};
}
function problem(q){return {userQuestion:q,intentHypotheses:[{intent:'identify_and_explain',confidence:.9}],referencedObjects:[]}}

test('plant routes to plant rather than repair',()=>{
 const d=classifyWorldDomain({observation:obs('','plant'),problem:problem('这株植物叶子有黄斑，是什么原因？')});
 assert.equal(d.primary,'plant');
});
test('food evidence asks for ingredients/date rather than device model',()=>{
 const o=obs('MANGO SNACK','food');
 const a=analyzeEvidenceGaps({state:{evidence:[{kind:'visual_identity',text:'food'}],activeEntitySummary:{photoCount:1}},problem:problem('这个食品有什么成分，会过期吗？'),observation:o});
 assert.equal(a.domain.primary,'food');
 const r=directEvidenceRequest({analysis:a});
 assert.match(r.request.instruction,/配料表|营养表|日期/);
 assert.doesNotMatch(r.request.instruction,/MODEL|铭牌/);
});
test('plant symptom asks for leaf front/back',()=>{
 const o=obs('','plant');
 const a=analyzeEvidenceGaps({state:{evidence:[{kind:'visual_identity',text:'plant'}],activeEntitySummary:{photoCount:1}},problem:problem('叶子有黄斑和虫怎么办？'),observation:o});
 const r=directEvidenceRequest({analysis:a});
 assert.match(r.request.instruction,/叶片正面和背面/);
});
test('animal strategy preserves safe distance',()=>{
 const a=analyzeEvidenceGaps({state:{evidence:[]},problem:problem('这是什么昆虫？'),observation:obs('','insect')});
 const r=directEvidenceRequest({analysis:a});
 assert.equal(a.domain.primary,'animal');
 assert.match(r.request.instruction+r.request.avoid,/安全距离|不要触碰|不要.*靠近/);
});
test('document asks for whole page, not repair evidence',()=>{
 const a=analyzeEvidenceGaps({state:{evidence:[]},problem:problem('这份合同是什么意思？'),observation:obs('CONTRATO','document','document')});
 const r=directEvidenceRequest({analysis:a});
 assert.equal(a.domain.primary,'document');
 assert.match(r.request.instruction,/整页|四个角/);
 assert.doesNotMatch(r.request.instruction,/错误代码|铭牌/);
});
test('translation asks for readable text',()=>{
 const a=analyzeEvidenceGaps({state:{evidence:[]},problem:problem('帮我翻译这个'),observation:obs('abc','document','document')});
 assert.equal(a.domain.primary,'translation');
 const r=directEvidenceRequest({analysis:a});
 assert.match(r.request.instruction,/文字|清晰可读/);
});
test('repair remains a specialist route, not default core',()=>{
 const general=classifyWorldDomain({observation:obs('','chair'),problem:problem('这是什么？')});
 const repair=classifyWorldDomain({observation:obs('ERROR E12','device'),problem:problem('机器故障 E12 怎么维修？')});
 assert.notEqual(general.primary,'repair');
 assert.equal(repair.primary,'repair');
});
test('universal explanation exposes domain-neutral routing',()=>{
 const e=buildUniversalExplanation({observation:obs('','plant'),textInput:'这株植物是什么？'});
 assert.equal(e.worldDomain.primary,'plant');
 assert.doesNotMatch(e.nextSteps.join(' '),/MODEL|错误代码|铭牌/);
});
test('vehicle guidance is contextual rather than automatically repair-centric',()=>{
 const a=analyzeEvidenceGaps({state:{evidence:[]},problem:problem('这个汽车仪表图标是什么意思？'),observation:obs('','car')});
 assert.equal(a.domain.primary,'vehicle');
 const r=directEvidenceRequest({analysis:a});
 assert.match(r.request.instruction,/车辆|整体|位置/);
});
test('world router supports broad product mission domains',()=>{
 const domains=['document','product','food','plant','animal','vehicle','place','finance','translation','repair','safety','general','unknown'];
 const s=buildUniversalEvidenceStrategy({domain:'general',problem:problem('这是什么')});
 assert.ok(s.requests.length>=1);
 assert.ok(domains.includes('repair')&&domains.includes('plant')&&domains.includes('document'));
});

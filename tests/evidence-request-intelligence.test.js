import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEvidenceGaps,directEvidenceRequest,evaluateEvidenceProgress} from '../core/resolution/evidence-request-intelligence.js';
import {buildUniversalExplanation,renderUniversalExplanationHtml} from '../core/explanation/universal-explainer.js';

function state(evidence=[],subject={label:'device'}){return {evidence,subject,attempts:[]}}
function problem(q='设备报错怎么办？',extra={}){return {userQuestion:q,intentHypotheses:[{intent:'troubleshoot',confidence:.9}],referencedObjects:[],...extra}}
function obs(text='',general=true){return {detectedType:'object',extractedText:text,confidence:{overall:.8},limitations:[],localResolutionPossible:false,observations:[
 ...(general?[{kind:'general_vision',providerId:'v',identity:[{label:'device',status:'observed',confidence:.9}],scene:[],states:[],anomalies:[],regions:[],relationships:[]}]:[]),
 {kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}
]}}

test('troubleshooting known device requests nameplate when model is missing',()=>{
 const a=analyzeEvidenceGaps({state:state([{kind:'visual_identity',text:'device'}]),problem:problem(),observation:obs()});
 assert.equal(a.gaps[0].type,'model');
 const r=directEvidenceRequest({analysis:a});
 assert.match(r.request.instruction,/铭牌/);
 assert.match(r.request.instruction,/MODEL/);
});

test('existing model evidence prevents asking for nameplate again',()=>{
 const st=state([{kind:'visual_identity',text:'device'},{kind:'ocr_text',text:'MODEL: ABC-123'}]);
 const a=analyzeEvidenceGaps({state:st,problem:problem(),observation:obs('MODEL: ABC-123')});
 assert.equal(a.gaps.some(x=>x.type==='model'),false);
});

test('error-code question asks for display only when code is absent',()=>{
 let a=analyzeEvidenceGaps({state:state([{kind:'visual_identity',text:'device'}]),problem:problem('屏幕有错误代码，怎么办？'),observation:obs()});
 assert.ok(a.gaps.some(x=>x.type==='error_code'));
 const r=directEvidenceRequest({analysis:{...a,gaps:a.gaps.filter(x=>x.type==='error_code')}});
 assert.match(r.request.instruction,/显示屏|报错区域/);
 a=analyzeEvidenceGaps({state:state([{kind:'visual_identity',text:'device'},{kind:'ocr_text',text:'ERROR E12 MODEL: ABC-123'}]),problem:problem('E12怎么办？'),observation:obs('ERROR E12 MODEL: ABC-123')});
 assert.equal(a.gaps.some(x=>x.type==='error_code'),false);
});

test('deictic reference requests grounded closeup with surrounding context',()=>{
 const a=analyzeEvidenceGaps({state:state([{kind:'visual_identity',text:'device'},{kind:'ocr_text',text:'MODEL: ABC-123'}]),problem:problem('这里坏了吗？',{referencedObjects:[{sourceText:'这里',requiresVisualGrounding:true}]}),observation:obs('MODEL: ABC-123')});
 const g=a.gaps.find(x=>x.type==='grounding');assert.ok(g);
 const r=directEvidenceRequest({analysis:{...a,gaps:[g]}});
 assert.match(r.request.instruction,/画面中央/);
 assert.match(r.request.instruction,/周围结构/);
});

test('connection problem requests connector and cable relationship',()=>{
 const a=analyzeEvidenceGaps({state:state([{kind:'visual_identity',text:'device'},{kind:'ocr_text',text:'MODEL: ABC-123'}]),problem:problem('这个接口和线连接对吗？'),observation:obs('MODEL: ABC-123')});
 const g=a.gaps.find(x=>x.type==='connection');assert.ok(g);
 const r=directEvidenceRequest({analysis:{...a,gaps:[g]}});
 assert.match(r.request.instruction,/接口、插头和线缆/);
});

test('dangerous damage capture guidance warns not to move closer',()=>{
 const a=analyzeEvidenceGaps({state:state([{kind:'visual_identity',text:'device'},{kind:'ocr_text',text:'MODEL: ABC-123'}]),problem:problem('这里是不是烧坏了？'),observation:obs('MODEL: ABC-123')});
 const g=a.gaps.find(x=>x.type==='damage_detail');assert.ok(g);
 const r=directEvidenceRequest({analysis:{...a,gaps:[g]}});
 assert.match(r.request.avoid,/裸露电线|冒烟|泄漏|高温/);
});

test('evidence progress reports resolved gaps between photos',()=>{
 const before={gaps:[{type:'model'},{type:'error_code'}]},after={gaps:[{type:'error_code'}]};
 const p=evaluateEvidenceProgress(before,after);
 assert.deepEqual(p.resolved,['model']);assert.equal(p.improved,true);assert.equal(p.complete,false);
});

test('universal explainer exposes capture request to user',()=>{
 const e=buildUniversalExplanation({observation:obs(),speechText:'设备报错怎么办？'});
 assert.ok(e.evidenceRequest?.request);
 assert.ok(e.nextSteps[0]);
 const html=renderUniversalExplanationHtml(e);
 assert.match(html,/capture-request/);
 assert.match(html,/为什么：/);
});

test('capture HTML escapes OCR-derived or dynamic text',()=>{
 const e=buildUniversalExplanation({observation:obs('<script>alert(1)</script>'),speechText:'设备报错怎么办？'});
 const html=renderUniversalExplanationHtml(e);
 assert.doesNotMatch(html,/<script>/);
});

test('complete evidence set does not invent another capture request',()=>{
 const st=state([
  {kind:'visual_identity',text:'device'},
  {kind:'ocr_text',text:'MODEL: ABC-123 ERROR E12'},
  {kind:'visual_state',text:'red indicator led'},
  {kind:'connection',text:'port cable connection'},
  {kind:'damage',text:'damage closeup'},
 ]);
 const a=analyzeEvidenceGaps({state:st,problem:problem('E12怎么处理？'),observation:obs('MODEL: ABC-123 ERROR E12')});
 assert.equal(a.gaps.some(x=>x.type==='model'||x.type==='error_code'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {planUniversalNextActions} from '../core/resolution/problem-solving-session.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

function state(){return {status:'investigating',attempts:[],evidence:[],proposedSteps:[]}}
function obs(label='object') {return {detectedType:label,extractedText:'',confidence:{overall:.8},limitations:[],localResolutionPossible:false,observations:[
  {kind:'general_vision',providerId:'v',identity:[{label,confidence:.9,status:'observed'}],scene:[],states:[],anomalies:[],regions:[],relationships:[],limitations:[]},
  {kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}
]}}

test('non-repair domains use domain-neutral next-action planning',()=>{
 const p=planUniversalNextActions({state:state(),worldDomain:{primary:'product'},problem:{userQuestion:'哪里买便宜'},resolution:{nextEvidence:[]},evidenceRequest:{request:{instruction:'请拍商品条码',gap:{type:'product_label'}}}});
 assert.equal(p.kind,'universal_next_actions');
 assert.equal(p.domain,'product');
 assert.match(p.nextStep.text,/商品条码/);
 assert.doesNotMatch(p.nextStep.text,/电源|重启|错误代码|维修/);
});

test('plant explanation cannot leak generic repair checks',()=>{
 const e=buildUniversalExplanation({observation:obs('plant'),textInput:'这株植物叶子有黄斑怎么办？'});
 assert.equal(e.worldDomain.primary,'plant');
 assert.equal(e.nextActionPlan.kind,'universal_next_actions');
 assert.doesNotMatch(e.nextSteps.join(' '),/电源|连接线|重启|错误代码/);
});

test('document explanation cannot leak device troubleshooting steps',()=>{
 const o=obs('document'); o.extractedText='CONTRATO DE ARRENDAMIENTO';
 const e=buildUniversalExplanation({observation:o,textInput:'这份合同是什么意思？'});
 assert.equal(e.worldDomain.primary,'document');
 assert.doesNotMatch(e.nextSteps.join(' '),/电源|指示灯|重启|铭牌/);
});

test('repair remains available only as an explicit specialist domain',()=>{
 const p=planUniversalNextActions({state:state(),worldDomain:{primary:'repair'},problem:{userQuestion:'设备不工作'},resolution:{nextEvidence:[]},helpPath:null,evidenceRequest:null});
 assert.notEqual(p.kind,'universal_next_actions');
 assert.match(p.nextStep?.text??'',/电源|连接线|开关/);
});

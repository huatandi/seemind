import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExplanationActionContract,renderExplanationActionText,buildTeacherExplanationPrompt} from '../core/explanation/explanation-action-contract.js';

function base(){
 return {
  observation:{confidence:{overall:.82},observations:[]},
  problem:{
   knownFacts:[{id:'identity.brand',name:'brand',category:'identity',value:'SAMSUNG',confidence:.95}],
   unknownFacts:[{id:'domain.model',name:'model',category:'domain'}],
   multimodalUnknowns:[],
   intentHypotheses:[{intent:'troubleshoot',confidence:.9,reason:'explicit_problem_language'}],
   problemSignals:[],
   confidence:{observation:.82,intent:.9},
  },
  resolution:{decision:'teacher_or_tool',canOfferSolutionNow:false,nextEvidence:[],escalation:{needed:true,preferredKinds:['troubleshooting'],sendPolicy:'minimum_necessary',sendOriginalImage:false}},
  multimodal:{
   symptoms:[{type:'blinking_indicator',sourceText:'红灯一直闪',confidence:.9}],
   attemptedActions:[{type:'power_cycle',sourceText:'拔过一次插头',confidence:.9}],
   temporalContext:[{type:'yesterday_context',sourceText:'昨天还正常',confidence:.9}],
  },
  helpPath:{kind:'teacher',message:'Use the best capable Teacher for the unresolved subproblem.'},
 };
}

test('contract strictly separates observed facts from user reports',()=>{
 const c=buildExplanationActionContract(base());
 assert.equal(c.observed.items[0].value,'SAMSUNG');
 assert.ok(c.userReported.items.some(x=>x.text==='红灯一直闪'));
 assert.equal(c.observed.items.some(x=>String(x.value).includes('红灯')),false);
 assert.equal(c.principles.userReportsAreNotVisualFacts,true);
});

test('intent remains a hypothesis instead of confirmed fact',()=>{
 const c=buildExplanationActionContract(base());
 const i=c.assessment.items.find(x=>x.kind==='intent_hypothesis');
 assert.equal(i.status,'hypothesis');
 assert.equal(i.confidence,.9);
});

test('unresolved facts stay visible',()=>{
 const c=buildExplanationActionContract(base());
 assert.ok(c.unknowns.items.some(x=>x.id==='domain.model'));
});

test('need-more-evidence becomes an actionable capture instruction',()=>{
 const x=base();
 x.resolution={decision:'need_more_evidence',canOfferSolutionNow:false,nextEvidence:[
  {kind:'capture_guidance',priority:1,instruction:'请拍设备背面的铭牌。',reason:'Need model'}
 ],escalation:{needed:true,preferredKinds:['vision'],sendPolicy:'minimum_necessary',sendOriginalImage:true}};
 const c=buildExplanationActionContract(x);
 assert.equal(c.actions.items[0].instruction,'请拍设备背面的铭牌。');
 assert.equal(c.escalation.nextEvidence[0].instruction,'请拍设备背面的铭牌。');
});

test('minimum-necessary escalation is preserved in output contract',()=>{
 const c=buildExplanationActionContract(base());
 assert.equal(c.escalation.needed,true);
 assert.equal(c.escalation.minimumNecessary,true);
 assert.equal(c.escalation.sendOriginalImage,false);
});

test('rendered Chinese answer visibly separates evidence categories',()=>{
 const c=buildExplanationActionContract(base());
 const text=renderExplanationActionText(c);
 assert.match(text,/我看到了什么/);
 assert.match(text,/你告诉了我什么/);
 assert.match(text,/我的判断/);
 assert.match(text,/我还不能确认什么/);
 assert.match(text,/SAMSUNG/);
 assert.match(text,/红灯一直闪/);
});

test('low-confidence assessment is visibly marked as low confidence',()=>{
 const x=base();
 x.problem.intentHypotheses=[{intent:'identify_and_explain',confidence:.45,reason:'image_default'}];
 const c=buildExplanationActionContract(x);
 const text=renderExplanationActionText(c);
 assert.match(text,/低把握\/推测/);
});

test('local explanation does not force escalation',()=>{
 const x=base();
 x.resolution={decision:'local_explain',canOfferSolutionNow:true,nextEvidence:[],escalation:{needed:false}};
 x.helpPath={kind:'local',message:'Student can continue locally.'};
 const c=buildExplanationActionContract(x);
 assert.equal(c.escalation.needed,false);
 assert.ok(c.actions.items.some(a=>a.kind==='continue_local'));
});

test('Teacher prompt requires evidence boundaries and useful fallback',()=>{
 const c=buildExplanationActionContract(base());
 const p=buildTeacherExplanationPrompt(c);
 assert.ok(p.requiredOutput.includes('actions'));
 assert.ok(p.rules.some(x=>/user-reported claims/.test(x)));
 assert.ok(p.rules.some(x=>/appropriate tool\/AI\/human expert/.test(x)));
});

test('contract never promotes an attempted action into observed visual fact',()=>{
 const c=buildExplanationActionContract(base());
 assert.ok(c.userReported.items.some(x=>x.type==='attempted_action'));
 assert.equal(c.observed.items.some(x=>x.label==='power_cycle'||x.value==='power_cycle'),false);
});

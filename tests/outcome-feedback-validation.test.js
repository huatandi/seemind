import test from 'node:test';
import assert from 'node:assert/strict';
import {OutcomeFeedbackStore,buildOutcomeValidation,outcomeValidationAdjustment,classifyAttribution} from '../core/perception/outcome-feedback.js';
import {routeVoiceEngines} from '../core/voice/voice-adaptive-router.js';

const deviceKey='balanced:8:8:nogpu:mobile';
const storage=(()=>{let x={};return {getItem:k=>x[k]??null,setItem:(k,v)=>{x[k]=v},removeItem:k=>{delete x[k]}}})();

test('downstream problem/search/teacher outcomes are explicitly not attributable to perception engines',()=>{
 for(const event of ['problem_unresolved','problem_resolved','search_failed','teacher_failed','human_handoff']){
  const a=classifyAttribution({event,modality:'vision'});
  assert.equal(a.attributable,false);
  assert.equal(a.scope,'downstream_outcome');
 }
});

test('repeated technical engine failures weaken runtime experience after enough evidence',()=>{
 const store=new OutcomeFeedbackStore({storage,storageKey:'t1'});
 for(let i=0;i<8;i++)store.record({modality:'vision',engineId:'v1',deviceKey,scenarios:['low_light'],kind:'technical',outcome:i<4?'failure':'success'});
 const validation=buildOutcomeValidation({rows:store.list(),modality:'vision',deviceKey,scenarios:['low_light']});
 const a=outcomeValidationAdjustment({engineId:'v1',validation});
 assert.equal(a.reason,'RUNTIME_TECHNICAL_REGRESSION');
 assert.ok(a.delta<0);
});

test('too few runtime outcomes cannot change ranking experience',()=>{
 const store=new OutcomeFeedbackStore({storage,storageKey:'t2'});
 for(let i=0;i<3;i++)store.record({modality:'vision',engineId:'v1',deviceKey,scenarios:['low_light'],kind:'technical',outcome:'failure'});
 const validation=buildOutcomeValidation({rows:store.list(),modality:'vision',deviceKey,scenarios:['low_light']});
 assert.equal(outcomeValidationAdjustment({engineId:'v1',validation}).delta,0);
});

test('explicit ASR corrections weaken only the matching voice scenario',()=>{
 const store=new OutcomeFeedbackStore({storage,storageKey:'t3'});
 for(let i=0;i<5;i++)store.record({modality:'voice',engineId:'asr',deviceKey,scenarios:['numbers'],kind:'quality',outcome:i<3?'corrected':'confirmed'});
 const numbers=buildOutcomeValidation({rows:store.list(),modality:'voice',deviceKey,scenarios:['numbers']});
 const brand=buildOutcomeValidation({rows:store.list(),modality:'voice',deviceKey,scenarios:['brand_model']});
 assert.ok(outcomeValidationAdjustment({engineId:'asr',validation:numbers}).delta<0);
 assert.equal(outcomeValidationAdjustment({engineId:'asr',validation:brand}).delta,0);
});

test('confirmed ASR stability can only add a small bounded bonus',()=>{
 const store=new OutcomeFeedbackStore({storage,storageKey:'t4'});
 for(let i=0;i<6;i++)store.record({modality:'voice',engineId:'good',deviceKey,scenarios:['brand_model'],kind:'quality',outcome:'confirmed'});
 const validation=buildOutcomeValidation({rows:store.list(),modality:'voice',deviceKey,scenarios:['brand_model']});
 const a=outcomeValidationAdjustment({engineId:'good',validation});
 assert.equal(a.reason,'USER_CONFIRMED_STABILITY');
 assert.ok(a.delta>0&&a.delta<=.06);
});

test('runtime outcome validation can overturn a stale scenario preference without bypassing router gates',()=>{
 const engines=[
  {id:'old-winner',profile:{languages:['auto'],streaming:true,local:true}},
  {id:'stable',profile:{languages:['auto'],streaming:true,local:true}},
 ];
 const route=routeVoiceEngines({
  engines,deviceProfile:{tier:'balanced'},
  scenarioEvidence:{scenarios:['numbers'],engineAdjustments:{'old-winner':.08}},
  outcomeValidation:{adjustments:{'old-winner':{delta:-.12,reasons:['USER_CORRECTION_REGRESSION'],stats:{}},stable:{delta:0,reasons:[],stats:{}}}},
 });
 assert.equal(route.primary.engine.id,'stable');
 assert.equal(route.ranked.find(x=>x.engine.id==='old-winner').reasons.outcomeValidation.reason,'USER_CORRECTION_REGRESSION');
});

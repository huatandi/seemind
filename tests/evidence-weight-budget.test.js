import test from 'node:test';
import assert from 'node:assert/strict';
import {composeEvidenceWeight} from '../core/perception/evidence-weight-budget.js';
import {rankVisualProviders} from '../core/vision/providers/visual-provider-router.js';
import {routeVoiceEngines} from '../core/voice/voice-adaptive-router.js';

test('correlated benchmark signals cannot stack beyond benchmark-family budget',()=>{
 const x=composeEvidenceWeight({modality:'vision',autotune:.08,lab:.16,scenario:.12,outcome:0});
 assert.ok(x.delta<=.16+.000001);
 assert.equal(x.capped,true);
 assert.ok(x.applied.autotune<x.raw.autotune);
 assert.ok(x.applied.lab<x.raw.lab);
 assert.ok(x.applied.scenario<x.raw.scenario);
});

test('all positive evidence cannot exceed global evidence budget',()=>{
 const x=composeEvidenceWeight({autotune:.08,lab:.16,scenario:.12,outcome:.06});
 assert.ok(x.delta<=.20+.000001);
});

test('negative evidence is bounded without turning into positive evidence',()=>{
 const x=composeEvidenceWeight({lab:-.22,scenario:-.12,outcome:-.16});
 assert.ok(x.delta>=-.28-.000001);
 assert.ok(x.delta<0);
});

test('vision router exposes raw and applied evidence budget for auditability',async()=>{
 const provider=id=>({
  id,
  getProfile:()=>({privacyModes:['local'],deviceClasses:['balanced'],capabilities:[{capability:'object_identity',score:.9}],reliability:.8,estimatedLatencyMs:800,estimatedMemoryMb:40,priority:50}),
  healthCheck:async()=>({status:'ok'}),
 });
 const ranked=await rankVisualProviders({
  providers:[provider('p1')],requiredCapabilities:['object_identity'],deviceClass:'balanced',deviceBudget:{maxMemoryMb:200},
  autotunePolicy:{providerPolicy:{p1:{recommendation:'preferred'}}},
  runtimeEvidence:{preferredEngineId:'p1',promotedEngineIds:['p1'],avoidEngineIds:[]},
  scenarioEvidence:{scenarios:['low_light'],engineAdjustments:{p1:.12}},
  outcomeValidation:{adjustments:{p1:{delta:.06,reasons:['USER_CONFIRMED_STABILITY'],stats:{}}}},
 });
 const b=ranked[0].components.evidenceBudget;
 assert.equal(b.raw.autotune,.08);
 assert.equal(b.raw.lab,.16);
 assert.equal(b.raw.scenario,.12);
 assert.equal(b.raw.outcome,.06);
 assert.ok(b.delta<=.20+.000001);
});

test('voice evidence budget prevents Lab + Scenario + Outcome bonus inflation',()=>{
 const engines=[
  {id:'a',profile:{languages:['auto'],streaming:true,local:true}},
  {id:'b',profile:{languages:['auto'],streaming:true,local:true}},
 ];
 const route=routeVoiceEngines({
  engines,deviceProfile:{tier:'balanced'},
  runtimeEvidence:{preferredEngineId:'a',promotedEngineIds:['a'],avoidEngineIds:[]},
  scenarioEvidence:{scenarios:['numbers'],engineAdjustments:{a:.12}},
  outcomeValidation:{adjustments:{a:{delta:.06,reasons:['USER_CONFIRMED_STABILITY'],stats:{}}}},
 });
 const a=route.ranked.find(x=>x.engine.id==='a');
 assert.ok(a.reasons.evidenceBudget.delta<=.20+.000001);
 assert.equal(a.reasons.evidenceBudget.capped,true);
});

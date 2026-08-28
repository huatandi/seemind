import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScenarioEvidence,scenarioEvidenceAdjustment,detectRuntimeScenarios} from '../core/perception/scenario-evidence-policy.js';
import {routeVoiceEngines} from '../core/voice/voice-adaptive-router.js';
import {rankVisualProviders} from '../core/vision/providers/visual-provider-router.js';
const deviceKey='balanced:8:8:nogpu:mobile',updatedAt='2026-08-26T12:00:00.000Z',now=Date.parse('2026-08-26T13:00:00.000Z');
const row=(engineId,modality,pattern,avgQuality,failureRate,cases=20)=>({engineId,modality,deviceKey,updatedAt,promotion:{promoted:true},meta:{failurePatterns:[{engineId,modality,pattern,cases,avgQuality,failureRate}]}});

test('scenario evidence requires enough cases for that exact scenario',()=>{
 const e=buildScenarioEvidence({modality:'voice',deviceKey,scenarios:['shop_noise'],now,labResults:[row('a','voice','shop_noise',.99,.01,3),row('b','voice','shop_noise',.8,.2,20)]});
 assert.equal(e.engineAdjustments.a,undefined);
 assert.equal(e.engineAdjustments.b,undefined);
});

test('clear same-device promoted scenario winner gets bounded bias',()=>{
 const e=buildScenarioEvidence({modality:'voice',deviceKey,scenarios:['shop_noise'],now,labResults:[row('a','voice','shop_noise',.94,.08),row('b','voice','shop_noise',.72,.55)]});
 assert.equal(scenarioEvidenceAdjustment({engineId:'a',scenarioEvidence:e}).reason,'SCENARIO_PROVEN_STRENGTH');
 assert.ok(e.engineAdjustments.a<=.12);
 assert.ok(e.engineAdjustments.b<0);
});

test('one scenario advantage does not leak into unrelated scenario',()=>{
 const e=buildScenarioEvidence({modality:'voice',deviceKey,scenarios:['numbers'],now,labResults:[row('a','voice','shop_noise',.98,.01),row('b','voice','shop_noise',.6,.7)]});
 assert.deepEqual(e.engineAdjustments,{});
});

test('vision scenario evidence cannot bypass capability gate',async()=>{
 const e=buildScenarioEvidence({modality:'vision',deviceKey,scenarios:['low_light'],now,labResults:[row('visual:bad','vision','low_light',.99,.01),row('visual:good','vision','low_light',.75,.4)]});
 const provider=(id,caps)=>({id,getProfile:()=>({privacyModes:['local'],deviceClasses:['balanced'],capabilities:caps,reliability:.8,estimatedLatencyMs:500,estimatedMemoryMb:50}),healthCheck:async()=>({status:'ok'})});
 const ranked=await rankVisualProviders({providers:[provider('bad',[]),provider('good',[{capability:'object_identity',score:.9}])],requiredCapabilities:['object_identity'],deviceClass:'balanced',deviceBudget:{maxMemoryMb:200},scenarioEvidence:e});
 assert.equal(ranked.length,1); assert.equal(ranked[0].provider.id,'good');
});

test('voice router can prefer proven engine only for active scenario',()=>{
 const e=buildScenarioEvidence({modality:'voice',deviceKey,scenarios:['shop_noise'],now,labResults:[row('a','voice','shop_noise',.95,.05),row('b','voice','shop_noise',.7,.6)]});
 const engines=['a','b'].map(id=>({id,profile:{languages:['auto'],streaming:true,local:true}}));
 const route=routeVoiceEngines({engines,deviceProfile:{tier:'balanced'},scenarioEvidence:e});
 assert.equal(route.primary.engine.id,'a');
 assert.equal(route.primary.reasons.scenarioEvidence.reason,'SCENARIO_PROVEN_STRENGTH');
});

test('runtime scenario detector uses only observable/current hints',()=>{
 assert.deepEqual(detectRuntimeScenarios({modality:'voice',userQuestion:'这个型号多少钱？',language:'auto'}).sort(),['brand_model','numbers']);
 assert.ok(detectRuntimeScenarios({modality:'vision',triage:{ocrMode:'support',visual:{brightRatio:.1}}}).includes('low_light'));
});

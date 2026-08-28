import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRuntimeEvidencePolicy,runtimeEvidenceAdjustment} from '../core/perception/runtime-evidence-policy.js';
import {routeVoiceEngines} from '../core/voice/voice-adaptive-router.js';
import {rankVisualProviders} from '../core/vision/providers/visual-provider-router.js';

const deviceKey='balanced:8:8:nogpu:mobile';
const updatedAt='2026-08-26T12:00:00.000Z';
const now=Date.parse('2026-08-26T13:00:00.000Z');

test('Lab evidence remains evidence-only when no clear promoted winner exists',()=>{
 const policy=buildRuntimeEvidencePolicy({modality:'voice',deviceKey,now,labResults:[
  {engineId:'a',modality:'voice',deviceKey,updatedAt,metrics:{cases:20,avgQuality:.92,successRate:.99,p50LatencyMs:700,p95LatencyMs:1300},promotion:{promoted:true}},
  {engineId:'b',modality:'voice',deviceKey,updatedAt,metrics:{cases:20,avgQuality:.915,successRate:.99,p50LatencyMs:690,p95LatencyMs:1280},promotion:{promoted:true}},
 ]});
 assert.equal(policy.preferredEngineId,null);
 assert.equal(policy.mode,'evidence_only');
});

test('clear promoted Lab winner becomes canary preference, not hard override',()=>{
 const policy=buildRuntimeEvidencePolicy({modality:'voice',deviceKey,now,labResults:[
  {engineId:'fast',modality:'voice',deviceKey,updatedAt,metrics:{cases:20,avgQuality:.97,successRate:1,p50LatencyMs:350,p95LatencyMs:600},promotion:{promoted:true}},
  {engineId:'slow',modality:'voice',deviceKey,updatedAt,metrics:{cases:20,avgQuality:.87,successRate:.98,p50LatencyMs:1100,p95LatencyMs:2200},promotion:{promoted:true}},
 ]});
 assert.equal(policy.preferredEngineId,'fast');
 assert.equal(runtimeEvidenceAdjustment({engineId:'fast',policy}).reason,'PROMOTED_CANARY');
});

test('voice router uses promoted canary evidence as a ranking bias',()=>{
 const policy={preferredEngineId:'b',promotedEngineIds:['b'],avoidEngineIds:[]};
 const engines=[
  {id:'a',profile:{languages:['auto'],streaming:true,local:true}},
  {id:'b',profile:{languages:['auto'],streaming:true,local:true}},
 ];
 const route=routeVoiceEngines({engines,deviceProfile:{tier:'balanced'},runtimeEvidence:policy});
 assert.equal(route.primary.engine.id,'b');
 assert.equal(route.primary.reasons.labEvidence.reason,'PROMOTED_CANARY');
});

test('visual router maps Lab visual:provider id to runtime provider id',async()=>{
 const policy=buildRuntimeEvidencePolicy({modality:'vision',deviceKey,now,labResults:[
  {engineId:'visual:p2',modality:'vision',deviceKey,updatedAt,metrics:{cases:20,avgQuality:.98,successRate:1,p50LatencyMs:500,p95LatencyMs:900},promotion:{promoted:true}},
  {engineId:'visual:p1',modality:'vision',deviceKey,updatedAt,metrics:{cases:20,avgQuality:.86,successRate:.97,p50LatencyMs:1200,p95LatencyMs:2600},promotion:{promoted:true}},
 ]});
 const provider=id=>({
  id,
  getProfile:()=>({privacyModes:['local'],deviceClasses:['balanced'],capabilities:[{capability:'object_identity',score:.9}],reliability:.8,estimatedLatencyMs:900,estimatedMemoryMb:50,priority:50}),
  healthCheck:async()=>({status:'ok'}),
 });
 const ranked=await rankVisualProviders({providers:[provider('p1'),provider('p2')],requiredCapabilities:['object_identity'],deviceClass:'balanced',deviceBudget:{maxMemoryMb:200},runtimeEvidence:policy});
 assert.equal(ranked[0].provider.id,'p2');
 assert.equal(ranked[0].components.labEvidence.reason,'PROMOTED_CANARY');
});

test('Lab regression penalizes but does not bypass capability/health gates',async()=>{
 const policy={preferredEngineId:null,promotedEngineIds:[],avoidEngineIds:['bad']};
 const provider={
  id:'bad',
  getProfile:()=>({privacyModes:['local'],deviceClasses:['balanced'],capabilities:[],reliability:1,estimatedLatencyMs:100,estimatedMemoryMb:10}),
  healthCheck:async()=>({status:'ok'}),
 };
 const ranked=await rankVisualProviders({providers:[provider],requiredCapabilities:['object_identity'],deviceClass:'balanced',deviceBudget:{maxMemoryMb:200},runtimeEvidence:policy});
 assert.equal(ranked.length,0);
});

test('undersized or stale Lab evidence cannot influence runtime',()=>{
 const policy=buildRuntimeEvidencePolicy({modality:'voice',deviceKey,now,labResults:[
  {engineId:'tiny',modality:'voice',deviceKey,updatedAt,metrics:{cases:3,avgQuality:1,successRate:1,p50LatencyMs:100,p95LatencyMs:200},promotion:{promoted:true}},
  {engineId:'old',modality:'voice',deviceKey,updatedAt:'2026-01-01T00:00:00.000Z',metrics:{cases:30,avgQuality:1,successRate:1,p50LatencyMs:100,p95LatencyMs:200},promotion:{promoted:true}},
 ]});
 assert.equal(policy.preferredEngineId,null);
 assert.equal(policy.evidenceCount,0);
 assert.equal(policy.ignoredEvidenceCount,2);
});

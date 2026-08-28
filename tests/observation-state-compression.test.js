import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceObservationKinds,countObservationKinds} from '../core/observation/observation-state.js';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';

test('dynamic semantic observation artifacts are replaced instead of accumulated',()=>{
 const obs={observations:[
  {kind:'problem_understanding',schemaVersion:1,id:'old-problem'},
  {kind:'resolution_plan',schemaVersion:1,id:'old-resolution'},
  {kind:'general_vision',identity:[]},
 ]};
 replaceObservationKinds(obs,{
  problem_understanding:{schemaVersion:2,id:'new-problem'},
  resolution_plan:{schemaVersion:2,id:'new-resolution'},
 });
 const counts=countObservationKinds(obs);
 assert.equal(counts.problem_understanding,1);
 assert.equal(counts.resolution_plan,1);
 assert.equal(obs.observations.find(x=>x.kind==='problem_understanding').id,'new-problem');
 assert.equal(obs.observations.find(x=>x.kind==='resolution_plan').id,'new-resolution');
});

test('multimodal fusion sees current resolution after replacement',()=>{
 const obs={
  detectedType:'object',confidence:{overall:.8},limitations:[],
  observations:[
   {kind:'resolution_plan',id:'old'},
   {kind:'visual_capability_plan',route:{missingCapabilities:[]}},
  ]
 };
 replaceObservationKinds(obs,{resolution_plan:{id:'current'}});
 const mm=fuseMultimodalContext({visualObservation:obs});
 assert.equal(mm.currentResolution.id,'current');
});

test('unrelated perception evidence survives semantic replacement',()=>{
 const obs={observations:[
  {kind:'general_vision',providerId:'p'},
  {kind:'runtime_latency',totalMs:500},
  {kind:'resolution_plan',id:'old'},
 ]};
 replaceObservationKinds(obs,{resolution_plan:{id:'new'}});
 assert.ok(obs.observations.some(x=>x.kind==='general_vision'));
 assert.ok(obs.observations.some(x=>x.kind==='runtime_latency'));
 assert.equal(obs.observations.filter(x=>x.kind==='resolution_plan').length,1);
});

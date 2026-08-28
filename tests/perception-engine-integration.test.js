import test from 'node:test';
import assert from 'node:assert/strict';
import {PerceptionEngineAdapter} from '../core/perception/perception-engine-adapter.js';
import {PerceptionEngineRegistry} from '../core/perception/perception-engine-registry.js';
import {PerceptionBenchmarkArena} from '../core/perception/perception-benchmark-arena.js';
import {PerceptionEngineHealth} from '../core/perception/perception-engine-health.js';
import {selectPerceptionEngines} from '../core/perception/perception-engine-selector.js';
import {executePerceptionRace} from '../core/perception/perception-executor.js';
import {rescoreSpeechAlternatives} from '../core/voice/voice-context-rescorer.js';
import {PERCEPTION_ENGINE_CANDIDATES} from '../core/perception/candidate-engine-catalog.js';
import {registerVisualProvidersInPerceptionRegistry} from '../core/perception/visual-provider-perception-bridge.js';
import {executeVoiceRecognition} from '../core/voice/voice-recognition-executor.js';
import {VoicePerformanceStore} from '../core/voice/voice-performance.js';

function adapter(id,{delay=1,confidence=.9,fail=false}={}){
 return new PerceptionEngineAdapter({
  id,profile:{modality:'vision',capabilities:['general_vision'],local:true,languages:['auto'],deviceTiers:['balanced']},
  infer:async()=>{await new Promise(r=>setTimeout(r,delay));if(fail)throw new Error('boom');return {confidence}}
 });
}

test('engine adapter loads once and exposes normalized timing',async()=>{
 let loads=0;const e=new PerceptionEngineAdapter({id:'x',profile:{},load:async()=>{loads++},infer:async()=>({confidence:.9})});
 const a=await e.infer('a'),b=await e.infer('b');
 assert.equal(loads,1);assert.ok(a.inferenceMs>=0);assert.ok(b.inferenceMs>=0);
});

test('runtime race falls back after primary failure',async()=>{
 const bad=adapter('bad',{fail:true}),good=adapter('good',{confidence:.93});
 const registry=new PerceptionEngineRegistry([bad,good]);
 const arena=new PerceptionBenchmarkArena(),health=new PerceptionEngineHealth();
 const selection=selectPerceptionEngines({registry,arena,health,modality:'vision',capability:'general_vision',deviceProfile:{tier:'balanced'}});
 const r=await executePerceptionRace({selection,input:{},capability:'general_vision',modality:'vision',arena,health,budget:{totalLocalMs:1000}});
 assert.equal(r.status,'completed');assert.equal(r.engineId,'good');assert.equal(r.attempts[0].status,'failed');
});

test('circuit breaker removes repeatedly failing engine from selection',async()=>{
 const bad=adapter('bad',{fail:true}),good=adapter('good');
 const registry=new PerceptionEngineRegistry([bad,good]),arena=new PerceptionBenchmarkArena(),health=new PerceptionEngineHealth({failureThreshold:2,cooldownMs:100000});
 for(let i=0;i<2;i++)health.failure('bad','X');
 const selection=selectPerceptionEngines({registry,arena,health,modality:'vision',capability:'general_vision',deviceProfile:{tier:'balanced'}});
 assert.equal(selection.primary.engine.id,'good');assert.ok(!selection.ranked.some(x=>x.engine.id==='bad'));
});

test('candidate catalog does not falsely claim unintegrated engines are installed',()=>{
 for(const c of PERCEPTION_ENGINE_CANDIDATES.filter(x=>['fastvlm','smolvlm','moonshine','sherpa_onnx','whisper_cpp'].includes(x.family)))assert.equal(c.status,'candidate');
});

test('visual context can rescue a lower acoustic ASR candidate',()=>{
 const observation={observations:[{kind:'general_vision',identity:[{label:'KIA Sportage',confidence:.9}],scene:[],regions:[]}]};
 const r=rescoreSpeechAlternatives({alternatives:[
  {text:'kia sporting',confidence:.92},
  {text:'kia sportage',confidence:.83},
 ],observation});
 assert.equal(r.primary.text,'kia sportage');
 assert.ok(r.primary.contextScore>=r.ranked[1].contextScore);
});

test('voice rescorer remains usable without visual context',()=>{
 const r=rescoreSpeechAlternatives({alternatives:[{text:'hello world',confidence:.8},{text:'yellow world',confidence:.5}]});
 assert.equal(r.primary.text,'hello world');
});

test('existing VisualProvider framework registers into perception catalog without replacing its executor',()=>{
 const provider={id:'visual-a',getProfile:()=>({capabilities:[{capability:'object_identity'}],privacyModes:['local'],deviceClasses:['balanced'],estimatedMemoryMb:50,reliability:.9,providerType:'local'}),analyze:async()=>({})};
 const registry=new PerceptionEngineRegistry();
 registerVisualProvidersInPerceptionRegistry(registry,[provider]);
 const c=registry.candidates({modality:'vision',capability:'object_identity',deviceProfile:{tier:'balanced'}});
 assert.equal(c.length,1);assert.equal(c[0].engine.sourceProvider,provider);
});

test('voice recognition executor falls back to second engine after failure',async()=>{
 const bad={id:'bad',listen:async()=>{throw new Error('nope')},stop(){}};
 const good={id:'good',listen:async()=>({text:'hello',alternatives:[{text:'hello',confidence:.9}]})};
 const route={primary:{engine:bad},fallbacks:[{engine:good}]};
 const perf=new VoicePerformanceStore();
 const r=await executeVoiceRecognition({route,performanceStore:perf,totalBudgetMs:1000,perEngineTimeoutMs:500});
 assert.equal(r.status,'completed');assert.equal(r.engineId,'good');assert.equal(r.attempts[0].status,'failed');
});

test('voice recognition executor respects total budget',async()=>{
 const slow={id:'slow',listen:()=>new Promise(()=>{}),stop(){}};
 const route={primary:{engine:slow},fallbacks:[]};
 const r=await executeVoiceRecognition({route,totalBudgetMs:30,perEngineTimeoutMs:20});
 assert.ok(['failed','budget_exhausted'].includes(r.status));assert.ok(r.attempts.length>=1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {wordErrorRate,semanticLabelScore} from '../core/perception/lab/benchmark-metrics.js';
import {createPerceptionLabSuite,runVisionLab,runVoiceLab} from '../core/perception/lab/perception-lab-suite.js';
import {evaluateEnginePromotion} from '../core/perception/lab/engine-promotion-policy.js';
import {chooseCanaryEngine} from '../core/perception/lab/canary-policy.js';
import {createExperimentalSmolVlmAdapter} from '../providers/experimental/vision/transformers-smolvlm-provider.js';
import {MoonshineRuntimeAdapter} from '../providers/experimental/voice/moonshine-runtime-adapter.js';
import {SherpaWasmRuntimeAdapter} from '../providers/experimental/voice/sherpa-wasm-runtime-adapter.js';
import {WORLD_VISION_CATEGORIES,validateWorldBenchmarkCoverage,weightedWorldScore} from '../core/perception/lab/world-benchmark-blueprint.js';
import {scoreMultimodalGrounding} from '../core/perception/lab/multimodal-benchmark.js';

test('WER reflects transcription edits',()=>{
 assert.equal(wordErrorRate('hello world','hello world'),0);
 assert.ok(wordErrorRate('hello world','yellow world')>0);
});

test('semantic visual score accepts explanatory text containing expected object',()=>{
 assert.equal(semanticLabelScore(['cat'],['a small cat sitting on a chair']),1);
});

test('vision lab produces quality and latency metrics',async()=>{
 const suite=createPerceptionLabSuite({visionCases:[{id:'cat',input:{},expectedLabels:['cat']},{id:'car',input:{},expectedLabels:['car']}]});
 let i=0;
 const engine={infer:async()=>({result:{labels:[i++===0?'cat':'car']}})};
 const r=await runVisionLab({suite,engine});
 assert.equal(r.successRate,1);assert.equal(r.avgQuality,1);assert.equal(r.cases,2);
});

test('voice lab measures WER and intent accuracy',async()=>{
 const suite=createPerceptionLabSuite({voiceCases:[{id:'v',input:{},expectedText:'what is this',expectedIntent:'identify'}]});
 const engine={transcribeCase:async()=>({text:'what is this',intent:'identify'})};
 const r=await runVoiceLab({suite,engine});
 assert.equal(r.avgWer,0);assert.equal(r.intentAccuracy,1);
});

test('promotion requires enough cases and release gate',()=>{
 const metrics={cases:20,successRate:.99,avgQuality:.92,p50LatencyMs:700,p95LatencyMs:1700};
 const p=evaluateEnginePromotion({engineId:'x',modality:'vision',metrics});
 assert.equal(p.promoted,true);
 const weak=evaluateEnginePromotion({engineId:'y',modality:'vision',metrics:{...metrics,cases:3}});
 assert.equal(weak.promoted,false);
});

test('canary policy refuses near-tie instead of inventing winner',()=>{
 const base={modality:'vision',deviceKey:'d',promotion:{promoted:true}};
 const r=chooseCanaryEngine({modality:'vision',deviceKey:'d',labResults:[
  {...base,engineId:'a',metrics:{avgQuality:.9,successRate:.99,p50LatencyMs:700,p95LatencyMs:1600}},
  {...base,engineId:'b',metrics:{avgQuality:.895,successRate:.99,p50LatencyMs:690,p95LatencyMs:1580}},
 ]});
 assert.equal(r.selected,null);assert.equal(r.reason,'NO_CLEAR_WINNER');
});

test('experimental SmolVLM adapter can be tested with injected pipeline without downloading model',async()=>{
 let task=null,model=null;
 const pipe=async(messages)=>[{generated_text:[...messages,{role:'assistant',content:'a cat on a chair'}]}];
 const adapter=createExperimentalSmolVlmAdapter({pipelineLoader:async()=>({pipeline:async(t,m)=>{task=t;model=m;return pipe}})});
 const fakeUrl='https://example.test/image.jpg';
 const out=await adapter.infer(fakeUrl,{prompt:'Describe'});
 assert.equal(task,'image-text-to-text');assert.equal(model,'HuggingFaceTB/SmolVLM-256M-Instruct');
 assert.match(out.result.text,/cat/);
});

test('voice experimental adapters remain unavailable without injected runtime',()=>{
 assert.equal(new MoonshineRuntimeAdapter({runtime:null}).isSupported(),false);
 assert.equal(new SherpaWasmRuntimeAdapter({runtime:null}).isSupported(),false);
});

test('world benchmark prevents receipt-heavy evaluation from defining universal vision quality',()=>{
 const cases=WORLD_VISION_CATEGORIES.map(c=>({category:c.id}));
 const good=validateWorldBenchmarkCoverage(cases);
 assert.equal(good.passed,true);
 const receiptHeavy=[...cases,...Array.from({length:10},()=>({category:'documents_receipts'}))];
 assert.equal(validateWorldBenchmarkCoverage(receiptHeavy).passed,false);
});

test('world score weights universal categories rather than receipt alone',()=>{
 const scores=Object.fromEntries(WORLD_VISION_CATEGORIES.map(c=>[c.id,c.id==='documents_receipts'?1:.8]));
 const score=weightedWorldScore(scores);
 assert.ok(score<1&&score>.8);
});

test('multimodal benchmark gives visual reference and target most of the weight',()=>{
 const perfect=scoreMultimodalGrounding({expected:{intent:'identify',reference:'red thing',target:'indicator',stateOrProblem:'blinking'},actual:{intent:'identify',reference:'red thing',target:'indicator',stateOrProblem:'blinking'}});
 assert.equal(perfect.score,1);
 const wrongTarget=scoreMultimodalGrounding({expected:{intent:'identify',reference:'red thing',target:'indicator'},actual:{intent:'identify',reference:'red thing',target:'button'}});
 assert.ok(wrongTarget.score<.8);
});

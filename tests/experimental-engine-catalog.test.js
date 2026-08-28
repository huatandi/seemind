import test from 'node:test';
import assert from 'node:assert/strict';
import {getExperimentalEngineSpec,createExperimentalEngine,canOfferExperimentalEngine} from '../core/perception/lab/experimental-engine-catalog.js';
import {buildWorldVisionBenchmarkPrompt} from '../core/perception/lab/vlm-prompt-policy.js';
import {wrapExperimentalVisionEngine} from '../core/perception/lab/experimental-benchmark-engine.js';
import {runBenchmarkCases} from '../core/perception/lab/benchmark-runner.js';

test('SmolVLM candidate is explicitly lab-only and not default-enabled',()=>{
 const s=getExperimentalEngineSpec('smolvlm-256m');
 assert.equal(s.requiresExplicitConsent,true);assert.equal(s.defaultEnabled,false);assert.equal(s.purpose,'small_vlm_candidate');
 assert.equal(canOfferExperimentalEngine(s,{tier:'low_power'}).allowed,false);
 assert.equal(canOfferExperimentalEngine(s,{tier:'balanced'}).allowed,true);
});

test('world VLM prompt tells candidate not to invent unsupported details',()=>{
 const p=buildWorldVisionBenchmarkPrompt({category:'devices_components',expected:{labels:['indicator']}});
 assert.match(p,/Do not invent/i);assert.match(p,/devices_components/);
});

test('experimental SmolVLM can execute through benchmark wrapper with injected pipeline',async()=>{
 const adapter=createExperimentalEngine('smolvlm-256m',{pipelineLoader:async()=>({
  pipeline:async()=>async()=>[{generated_text:[{role:'assistant',content:'red warning indicator'}]}]
 })});
 const engine=wrapExperimentalVisionEngine(adapter);
 const session=await runBenchmarkCases({
  engine,modality:'vision',
  cases:[{id:'x',assetRef:'https://example.test/x.jpg',category:'devices_components',language:'en',expected:{labels:['warning indicator']}}],
  resolveAsset:async x=>x,
  scoreCase:async({result})=>({ok:true,quality:/warning indicator/i.test(result.text)?1:0}),
 });
 assert.equal(session.summary.successRate,1);assert.equal(session.summary.avgQuality,1);
 await engine.dispose();
});

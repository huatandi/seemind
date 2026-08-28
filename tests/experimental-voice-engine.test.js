import test from 'node:test';
import assert from 'node:assert/strict';
import {TransformersWhisperProvider} from '../providers/experimental/voice/transformers-whisper-provider.js';
import {getExperimentalVoiceEngineSpec,createExperimentalVoiceEngine,canOfferExperimentalVoiceEngine} from '../core/perception/lab/experimental-voice-engine-catalog.js';
import {runBenchmarkCases} from '../core/perception/lab/benchmark-runner.js';
import {scoreVoiceBenchmarkCase} from '../core/perception/lab/voice-benchmark-scorer.js';

test('Whisper Tiny multilingual stays opt-in and excludes low-power by default',()=>{
 const s=getExperimentalVoiceEngineSpec('whisper-tiny-multilingual');
 assert.equal(s.defaultEnabled,false);assert.equal(s.requiresExplicitConsent,true);
 assert.ok(s.languages.includes('zh'));assert.ok(s.languages.includes('es'));assert.ok(s.languages.includes('en'));
 assert.equal(canOfferExperimentalVoiceEngine(s,{tier:'low_power'}).allowed,false);
 assert.equal(canOfferExperimentalVoiceEngine(s,{tier:'balanced'}).allowed,true);
});

test('Whisper provider can transcribe predecoded 16k audio with injected pipeline',async()=>{
 let received=null,options=null;
 const engine=new TransformersWhisperProvider({pipelineLoader:async()=>({pipeline:async()=>async(audio,opts)=>{received=audio;options=opts;return {text:'你好 mundo'}}})});
 const audio=new Float32Array([0,.1,-.1,0]);
 const out=await engine.transcribeCase(audio,{language:'zh-CN'});
 assert.equal(out.text,'你好 mundo');assert.equal(received,audio);assert.equal(options.language,'chinese');
});

test('experimental voice engine runs through standard benchmark and WER scorer',async()=>{
 const engine=createExperimentalVoiceEngine('whisper-tiny-multilingual',{pipelineLoader:async()=>({pipeline:async()=>async()=>({text:'hola mundo'})})});
 const session=await runBenchmarkCases({
  engine,modality:'voice',cases:[{id:'v1',assetRef:'a',language:'es-MX',expected:{text:'hola mundo'}}],
  resolveAsset:async()=>new Float32Array([0,0,0]),scoreCase:scoreVoiceBenchmarkCase,
 });
 assert.equal(session.summary.successRate,1);assert.equal(session.summary.avgQuality,1);
});

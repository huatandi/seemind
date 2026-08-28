import test from 'node:test';
import assert from 'node:assert/strict';
import {SherpaWasmProvider} from '../providers/experimental/voice/sherpa-wasm-provider.js';
import {getExperimentalVoiceEngineSpec,createExperimentalVoiceEngine} from '../core/perception/lab/experimental-voice-engine-catalog.js';
import {eligibleVoiceEngines,buildVoiceLeagueMatrix,recommendVoiceEngineForCohort} from '../core/perception/lab/voice-league.js';

test('Sherpa candidate declares only Chinese and English',()=>{
 const s=getExperimentalVoiceEngineSpec('sherpa-zh-en-wasm');
 assert.deepEqual(s.languages,['zh','en']);assert.equal(s.requiresInstalledRuntime,true);assert.equal(s.defaultEnabled,false);
});

test('Sherpa refuses Spanish and does not claim runtime availability',async()=>{
 const e=createExperimentalVoiceEngine('sherpa-zh-en-wasm');
 assert.equal(e.supportsLanguage('zh-CN'),true);assert.equal(e.supportsLanguage('en-US'),true);assert.equal(e.supportsLanguage('es-MX'),false);
 await assert.rejects(()=>e.transcribeCase(new Float32Array([0]),{language:'es-MX'}),/SHERPA_LANGUAGE_UNSUPPORTED/);
 await assert.rejects(()=>e.transcribeCase(new Float32Array([0]),{language:'zh-CN'}),/SHERPA_RUNTIME_NOT_INSTALLED/);
});

test('Sherpa adapter can execute through an injected compatible runtime',async()=>{
 const e=new SherpaWasmProvider({runtimeLoader:async()=>({createOfflineRecognizer:async()=>({transcribe:async()=>({text:'你好世界'})})})});
 const out=await e.transcribeCase(new Float32Array([0,.1]),{language:'zh-CN'});
 assert.equal(out.text,'你好世界');
});

test('language eligibility keeps Sherpa out of Spanish cohort',()=>{
 const sherpa={id:'sherpa',profile:{languages:['zh','en']},supportsLanguage:l=>/^zh|^en/.test(String(l))};
 const whisper={id:'whisper',profile:{languages:['multilingual']}};
 assert.deepEqual(eligibleVoiceEngines([sherpa,whisper],'es').map(x=>x.id),['whisper']);
});

test('voice matrix recommendation is quality-first then latency within tolerance',()=>{
 const league={rounds:[{language:'en',status:'completed',competition:{baselineEngineId:'a',decisions:[
  {engineId:'a',metrics:{cases:10,avgQuality:.94,successRate:1,p50LatencyMs:900,p95LatencyMs:1500},promotion:{}},
  {engineId:'b',metrics:{cases:10,avgQuality:.935,successRate:1,p50LatencyMs:400,p95LatencyMs:700},promotion:{},comparison:{verdict:'MIXED_OR_TIE'}},
 ]}}]};
 const matrix=buildVoiceLeagueMatrix(league);
 const rec=recommendVoiceEngineForCohort(matrix.en);
 assert.equal(rec.engineId,'b');assert.equal(rec.evidenceOnly,true);
});

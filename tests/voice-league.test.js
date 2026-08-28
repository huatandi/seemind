import test from 'node:test';
import assert from 'node:assert/strict';
import {TransformersMoonshineProvider} from '../providers/experimental/voice/transformers-moonshine-provider.js';
import {getExperimentalVoiceEngineSpec,createExperimentalVoiceEngine} from '../core/perception/lab/experimental-voice-engine-catalog.js';
import {buildVoiceLeagueCohorts,eligibleVoiceEngines,runVoiceLeague} from '../core/perception/lab/voice-league.js';
import {scoreVoiceBenchmarkCase} from '../core/perception/lab/voice-benchmark-scorer.js';

test('Moonshine candidate is English-only in the catalog',()=>{
 const s=getExperimentalVoiceEngineSpec('moonshine-base-en');
 assert.deepEqual(s.languages,['en']);assert.equal(s.defaultEnabled,false);assert.equal(s.purpose,'fast_english_file_asr_candidate');
});

test('Moonshine refuses Spanish and Chinese rather than pretending multilingual support',async()=>{
 const e=new TransformersMoonshineProvider({pipelineLoader:async()=>({pipeline:async()=>async()=>({text:'hello'})})});
 assert.equal(e.supportsLanguage('en-US'),true);assert.equal(e.supportsLanguage('es-MX'),false);assert.equal(e.supportsLanguage('zh-CN'),false);
 await assert.rejects(()=>e.transcribeCase(new Float32Array([0]),{language:'es-MX'}),/MOONSHINE_LANGUAGE_UNSUPPORTED/);
});

test('voice league builds separate language cohorts',()=>{
 const c=buildVoiceLeagueCohorts([{id:'a',language:'en-US'},{id:'b',language:'es-MX'},{id:'c',language:'zh-CN'}]);
 assert.deepEqual(c.map(x=>x.language).sort(),['en','es','zh']);
});

test('eligible engine filtering protects non-English cohorts from Moonshine',()=>{
 const multi={id:'multi',profile:{languages:['multilingual']}};
 const en={id:'en',profile:{languages:['en']},supportsLanguage:l=>String(l).startsWith('en')};
 assert.deepEqual(eligibleVoiceEngines([multi,en],'es').map(x=>x.id),['multi']);
 assert.deepEqual(eligibleVoiceEngines([multi,en],'en').map(x=>x.id),['multi','en']);
});

test('voice league compares multilingual and English engine only on English cohort',async()=>{
 const multi={id:'multi',profile:{languages:['multilingual']},transcribeCase:async(_a,{language})=>({text:language==='en'?'hello world':'hola mundo'})};
 const en={id:'en-fast',profile:{languages:['en']},supportsLanguage:l=>String(l).startsWith('en'),transcribeCase:async()=>({text:'hello world'})};
 const cases=[
  {id:'en1',assetRef:'en',language:'en-US',expected:{text:'hello world'}},
  {id:'es1',assetRef:'es',language:'es-MX',expected:{text:'hola mundo'}},
 ];
 const league=await runVoiceLeague({engines:[multi,en],cases,deviceProfile:{tier:'balanced'},resolveAsset:async x=>x,scoreCase:scoreVoiceBenchmarkCase});
 const er=league.rounds.find(x=>x.language==='en'),sr=league.rounds.find(x=>x.language==='es');
 assert.equal(er.competition.sessions.length,2);assert.equal(sr.competition.sessions.length,1);assert.equal(sr.competition.sessions[0].engineId,'multi');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {routeVoiceEngines} from '../core/voice/voice-adaptive-router.js';
import {rescoreSpeechAlternatives} from '../core/voice/voice-context-rescorer.js';
import {executeVoiceRecognition} from '../core/voice/voice-recognition-executor.js';
import {VoicePerformanceStore} from '../core/voice/voice-performance.js';

function engine(id,languages){return {id,profile:{languages,streaming:true,local:true},listen:async()=>({text:'ok'})}}

test('BCP-47 locale matches a base-language engine instead of being penalized',()=>{
  const zh=engine('zh',['zh']),en=engine('en',['en']);
  const r=routeVoiceEngines({engines:[en,zh],language:'zh-CN',deviceProfile:{tier:'balanced'}});
  assert.equal(r.primary.engine.id,'zh');
  assert.equal(r.primary.reasons.languageFit,1);
});

test('multilingual voice engine is a full language fit for Spanish regional locale',()=>{
  const multi=engine('multi',['multilingual']),en=engine('en',['en']);
  const r=routeVoiceEngines({engines:[en,multi],language:'es-MX',deviceProfile:{tier:'balanced'}});
  assert.equal(r.primary.engine.id,'multi');
  assert.equal(r.primary.reasons.languageFit,1);
});

test('context-dominated ASR choice requires confirmation rather than silent correction',()=>{
  const observation={observations:[{kind:'ocr',rawText:'Sportage Sportage'}]};
  const r=rescoreSpeechAlternatives({
    alternatives:[{text:'Sportage',confidence:.55},{text:'sporting',confidence:.46}],
    observation,
  });
  assert.equal(r.primary.text,'Sportage');
  assert.ok(r.quality.reasons.includes('CONTEXT_DOMINATES_ACOUSTIC'));
  assert.equal(r.quality.shouldClarify,true);
});

test('failed voice attempt retains first-partial latency for runtime diagnosis',async()=>{
  const perf=new VoicePerformanceStore();
  const bad={id:'partial-then-fail',profile:{languages:['auto'],streaming:true,local:true},
    listen:async({onInterim})=>{onInterim?.('hola');throw new Error('network')},stop(){}};
  const r=await executeVoiceRecognition({route:{primary:{engine:bad},fallbacks:[]},performanceStore:perf,totalBudgetMs:500,perEngineTimeoutMs:300});
  assert.equal(r.status,'failed');
  assert.ok(Number.isFinite(r.attempts[0].partialLatencyMs));
  assert.ok(Number.isFinite(perf.get('partial-then-fail').avgPartialLatencyMs));
});

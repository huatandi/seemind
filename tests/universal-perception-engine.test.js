import test from 'node:test';
import assert from 'node:assert/strict';
import {runPerceptionFastTriage} from '../core/perception/perception-fast-triage.js';
import {createPerceptionBudget} from '../core/perception/perception-budget.js';
import {VoiceEngineRegistry} from '../core/voice/voice-engine-registry.js';
import {routeVoiceEngines} from '../core/voice/voice-adaptive-router.js';
import {VoicePerformanceStore} from '../core/voice/voice-performance.js';
import {PerceptionEngineRegistry} from '../core/perception/perception-engine-registry.js';
import {PerceptionBenchmarkArena} from '../core/perception/perception-benchmark-arena.js';
import {evaluatePerceptionRelease} from '../core/perception/perception-release-gate.js';

test('receipt/document remains a specialist route when filename or question explicitly indicates it',async()=>{
 const f=new Blob(['x'],{type:'image/jpeg'});Object.defineProperty(f,'name',{value:'receipt-supermarket.jpg'});
 const t=await runPerceptionFastTriage(f,{userQuestion:'帮我读 TOTAL'});
 assert.equal(t.primaryRoute,'document');assert.equal(t.needsOcr,true);assert.equal(t.policy.receiptIsSpecialistBranch,true);
});

test('ordinary image is not forced into receipt OCR when no text evidence exists',async()=>{
 const f=new Blob(['x'],{type:'image/jpeg'});Object.defineProperty(f,'name',{value:'garden-photo.jpg'});
 const t=await runPerceptionFastTriage(f,{userQuestion:'这是什么植物？'});
 assert.notEqual(t.primaryRoute,'document');assert.equal(t.needsGeneralVision,true);
});

test('universal vision route receives a tighter OCR budget than document route',()=>{
 const device={tier:'balanced'};
 const universal=createPerceptionBudget(device,{primaryRoute:'universal_vision'});
 const doc=createPerceptionBudget(device,{primaryRoute:'document'});
 assert.equal(universal.ocrPriority,'deferred');assert.equal(doc.ocrPriority,'high');assert.ok(doc.ocrCandidates>=universal.ocrCandidates);
});

test('voice registry is provider-neutral and can hold future local engines',()=>{
 const a={id:'engine-a',profile:{streaming:true,local:true,languages:['auto']},isSupported:()=>true};
 const b={id:'engine-b',profile:{streaming:false,local:true,languages:['auto']},isSupported:()=>true};
 const r=new VoiceEngineRegistry([a,b]);
 assert.equal(r.supported().length,2);
 const route=routeVoiceEngines({engines:r.supported(),language:'zh',deviceProfile:{tier:'balanced'}});
 assert.equal(route.primary.engine.id,'engine-a');
});

test('voice router can learn that a faster reliable engine should win',()=>{
 const a={id:'a',profile:{streaming:true,local:true,languages:['auto']}};
 const b={id:'b',profile:{streaming:true,local:true,languages:['auto']}};
 const perf=new VoicePerformanceStore();
 for(let i=0;i<5;i++){perf.record('a',{ok:true,finalLatencyMs:1200});perf.record('b',{ok:true,finalLatencyMs:350})}
 const route=routeVoiceEngines({engines:[a,b],language:'es',deviceProfile:{tier:'balanced'},performanceStore:perf});
 assert.equal(route.primary.engine.id,'b');
});

test('voice performance records partial and final latency separately',()=>{
 const p=new VoicePerformanceStore();p.record('x',{ok:true,partialLatencyMs:180,finalLatencyMs:620,intentCorrect:true});
 const x=p.get('x');assert.equal(x.avgPartialLatencyMs,180);assert.equal(x.avgFinalLatencyMs,620);assert.equal(x.intentAccuracy,1);
});

test('perception registry does not bind SeeMind to a named model vendor',()=>{
 const engine={id:'future-vlm',profile:{modality:'vision',capabilities:['general_vision'],local:true,languages:['auto'],deviceTiers:['balanced']},isSupported:()=>true};
 const r=new PerceptionEngineRegistry([engine]);
 assert.equal(r.candidates({modality:'vision',capability:'general_vision',deviceProfile:{tier:'balanced'},language:'ja'}).length,1);
});

test('benchmark arena separates p50 and p95 latency',()=>{
 const a=new PerceptionBenchmarkArena();
 for(const ms of [300,400,500,600,3000])a.record({engineId:'x',modality:'vision',capability:'general_vision',latencyMs:ms,ok:true,quality:.9});
 const m=a.summarize({engineId:'x'});
 assert.ok(m.p95LatencyMs>=m.p50LatencyMs);assert.equal(m.successRate,1);
});

test('release gate rejects smart but too-slow perception engine',()=>{
 const g=evaluatePerceptionRelease({metrics:{successRate:.99,avgQuality:.94,p50LatencyMs:2400,p95LatencyMs:7000}});
 assert.equal(g.passed,false);assert.ok(g.checks.some(x=>x.id==='p50_latency'&&!x.passed));
});

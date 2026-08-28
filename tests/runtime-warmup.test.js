import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeWarmup,warmupPolicy,classifyStartupSample} from '../core/performance/runtime-warmup.js';
import {TesseractOcrEngine} from '../providers/local/tesseract-ocr.js';

test('low power or save-data devices do not idle-prewarm normal runtimes',()=>{
 assert.equal(warmupPolicy({tier:'low_power',connection:{}}).idleWarmup,false);
 assert.equal(warmupPolicy({tier:'performance',connection:{saveData:true}}).idleWarmup,false);
});

test('warmup is bounded by device cost policy and never grants routing authority',async()=>{
 let calls=0;
 const w=createRuntimeWarmup({deviceProfile:{tier:'balanced',connection:{}},now:(()=>{let n=0;return()=>++n})()});
 const heavy=await w.run('heavy',async()=>{calls++},{cost:'heavy'});
 assert.equal(heavy.state,'skipped');assert.equal(calls,0);
 const light=await w.run('light',async()=>{calls++},{cost:'light'});
 assert.equal(light.state,'ready');assert.equal(calls,1);
 const snap=w.snapshot();assert.equal(snap.policy.heavyModelsOnDemandOnly,true);assert.equal('route' in snap,false);assert.equal('answer' in snap,false);
});

test('Tesseract warmup loads runtime without performing recognition',async()=>{
 let loads=0,recognitions=0;
 const e=new TesseractOcrEngine({loader:async()=>{loads++;return {recognize(){recognitions++}}}});
 const out=await e.warmup();assert.equal(out.runtimeReady,true);assert.equal(loads,1);assert.equal(recognitions,0);
});

test('startup samples distinguish cold warm and hot reuse',()=>{
 assert.equal(classifyStartupSample({firstRun:true}),'cold');
 assert.equal(classifyStartupSample({previousUseAt:1000,now:2000}),'hot');
 assert.equal(classifyStartupSample({previousUseAt:1000,now:1_000_000}),'warm');
});

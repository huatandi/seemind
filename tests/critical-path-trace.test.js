import test from 'node:test';
import assert from 'node:assert/strict';
import {createCriticalPathTrace,analyzeCriticalPath} from '../core/performance/critical-path-trace.js';

test('critical path ranks measured stages without gaining routing authority',()=>{
 let t=100;const x=createCriticalPathTrace({startedAt:100,now:()=>t});
 x.start('fast_triage');t=180;x.end('fast_triage');x.mark('first_useful');
 x.start('ocr_preprocess');t=380;x.end('ocr_preprocess');x.start('ocr_ensemble');t=880;x.end('ocr_ensemble');
 const s=x.snapshot({completedAt:900});
 assert.equal(s.longestStage,'ocr_ensemble');assert.equal(s.longestStageMs,500);assert.equal(s.policy.noRoutingAuthority,true);
 assert.equal('decision' in s,false);assert.equal('route' in s,false);assert.equal('answer' in s,false);
});

test('critical path analysis reports repeated decode instead of guessing an optimization',()=>{
 const a=analyzeCriticalPath({totalMs:1000,spans:[{name:'image_decode',durationMs:100},{name:'attachment_decode',durationMs:120},{name:'vision',durationMs:500}]});
 assert.equal(a.bottleneck.name,'vision');assert.ok(a.warnings.includes('REPEATED_IMAGE_DECODE'));assert.equal(a.policy,'MEASURE_BEFORE_OPTIMIZE');
});

test('overlapping spans remain independent measurements',()=>{
 let t=0;const x=createCriticalPathTrace({startedAt:0,now:()=>t});x.start('ocr');t=10;x.start('vision');t=80;x.end('ocr');t=110;x.end('vision');
 const s=x.snapshot({completedAt:110});assert.equal(s.spans.find(x=>x.name==='ocr').durationMs,80);assert.equal(s.spans.find(x=>x.name==='vision').durationMs,100);
});

test('critical path trace can record externally measured nested stage',()=>{
 const trace=createCriticalPathTrace({startedAt:0,now:()=>100});
 trace.record('ocr_recognition',35,{engine:'x'});
 const snap=trace.snapshot({completedAt:100});
 assert.equal(snap.spans[0].durationMs,35);
 assert.equal(snap.spans[0].meta.measuredExternally,true);
 assert.equal(snap.longestStage,'ocr_recognition');
});

test('critical path analysis ranks leaf stages ahead of parent wrappers',()=>{
 const a=analyzeCriticalPath({totalMs:1000,spans:[
  {name:'ocr_ensemble',startMs:100,endMs:800,durationMs:700,meta:{}},
  {name:'ocr_recognition',startMs:200,endMs:650,durationMs:450,meta:{nested:true}}
 ]});
 assert.equal(a.actionableBottleneck.name,'ocr_recognition');
 assert.equal(a.actionableBottleneck.durationMs,450);
});

test('critical path analysis reports unaccounted latency instead of hiding gaps',()=>{
 const a=analyzeCriticalPath({totalMs:1000,spans:[{name:'decode',startMs:0,endMs:200,durationMs:200},{name:'recognition',startMs:300,endMs:700,durationMs:400}]});
 assert.equal(a.coveredMs,600);assert.equal(a.unaccountedMs,400);assert.ok(a.warnings.includes('SIGNIFICANT_UNACCOUNTED_LATENCY'));
});

test('critical path snapshot exposes first useful latency',()=>{
 let t=0;const x=createCriticalPathTrace({startedAt:0,now:()=>t});t=125;x.mark('first_useful');t=500;
 const s=x.snapshot({completedAt:500});assert.equal(s.firstUsefulMs,125);
});

test('snapshot reports dangling stages so instrumentation bugs are visible',()=>{
 let t=0;const x=createCriticalPathTrace({startedAt:0,now:()=>t});x.start('ocr');t=100;
 const s=x.snapshot({completedAt:100});assert.deepEqual(s.openStages,['ocr']);
});

test('local student publishes actionable critical-path analysis beside raw trace',async()=>{
 const fs=await import('node:fs/promises');const src=await fs.readFile(new URL('../providers/local/local-student.js',import.meta.url),'utf8');
 assert.match(src,/analyzeCriticalPath/);assert.match(src,/observations\.push\(analyzeCriticalPath\(criticalPathSnapshot\)\)/);
});

test('actionable bottleneck uses exclusive leaf time instead of overlapping child inflation',()=>{
 const a=analyzeCriticalPath({totalMs:1000,spans:[
  {name:'ocr',startMs:0,endMs:900,durationMs:900},
  {name:'decode',startMs:0,endMs:300,durationMs:300},
  {name:'recognition',startMs:300,endMs:800,durationMs:500},
  {name:'fusion',startMs:800,endMs:900,durationMs:100}
 ]});
 assert.equal(a.actionableBottleneck.name,'recognition');assert.equal(a.actionableBottleneck.exclusiveMs,500);
});

test('critical path analysis separates time before and after first useful result',()=>{
 const a=analyzeCriticalPath({totalMs:900,firstUsefulMs:120,spans:[]});
 assert.equal(a.beforeFirstUsefulMs,120);assert.equal(a.afterFirstUsefulMs,780);
});

test('dangling timing stages degrade instrumentation health',()=>{
 const a=analyzeCriticalPath({totalMs:100,openStages:['ocr'],spans:[{name:'decode',startMs:0,endMs:100,durationMs:100}]});
 assert.equal(a.instrumentationHealth,'degraded');assert.ok(a.warnings.includes('OPEN_TIMING_STAGES'));
});

test('large unaccounted latency reports partial instrumentation health',()=>{
 const a=analyzeCriticalPath({totalMs:1000,spans:[{name:'decode',startMs:0,endMs:100,durationMs:100}]});
 assert.equal(a.instrumentationHealth,'partial');
});

test('equal-duration bottlenecks are ranked deterministically by start then name',()=>{
 const a=analyzeCriticalPath({totalMs:500,spans:[{name:'z',startMs:100,endMs:300,durationMs:200},{name:'a',startMs:0,endMs:200,durationMs:200}]});
 assert.equal(a.bottleneck.name,'a');
});

test('covered timing is clamped to observed total duration',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'decode',startMs:0,endMs:180,durationMs:180}]});
 assert.equal(a.coveredMs,100);assert.equal(a.unaccountedMs,0);
});

test('analysis ranks work delaying first useful result separately',()=>{
 const a=analyzeCriticalPath({totalMs:1000,firstUsefulMs:300,spans:[
  {name:'decode',startMs:0,endMs:250,durationMs:250},{name:'deep_analysis',startMs:300,endMs:900,durationMs:600}
 ]});
 assert.equal(a.preUsefulSpans[0].name,'decode');assert.equal(a.preUsefulSpans[0].preFirstUsefulMs,250);
});

test('optimization target prefers first-useful blocker over post-result long work',()=>{
 const a=analyzeCriticalPath({totalMs:1000,firstUsefulMs:300,spans:[
  {name:'decode',startMs:0,endMs:250,durationMs:250},{name:'deep_analysis',startMs:300,endMs:900,durationMs:600}
 ]});
 assert.equal(a.optimizationTarget.name,'decode');
});

test('repeated stage measurements are surfaced for instrumentation review',()=>{
 const a=analyzeCriticalPath({totalMs:200,spans:[{name:'decode',startMs:0,endMs:50,durationMs:50},{name:'decode',startMs:60,endMs:100,durationMs:40}]});
 assert.deepEqual(a.duplicateStageNames,['decode']);assert.ok(a.warnings.includes('REPEATED_STAGE_MEASUREMENTS'));
});

test('malformed timing spans degrade instrumentation instead of corrupting coverage',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'bad',startMs:80,endMs:20,durationMs:-60},{name:'ok',startMs:0,endMs:40,durationMs:40}]});
 assert.equal(a.malformedCount,1);assert.equal(a.coveredMs,40);assert.equal(a.instrumentationHealth,'degraded');assert.ok(a.warnings.includes('MALFORMED_TIMING_SPANS'));
});


test('malformed spans cannot become ranked bottlenecks or optimization targets',()=>{
 const a=analyzeCriticalPath({totalMs:100,firstUsefulMs:50,spans:[{name:'bad',startMs:0,endMs:40,durationMs:-1},{name:'ok',startMs:0,endMs:20,durationMs:20}]});
 assert.equal(a.bottleneck.name,'ok');assert.equal(a.optimizationTarget.name,'ok');
});


test('first useful timing is clamped to observed total and flagged when out of range',()=>{
 const a=analyzeCriticalPath({totalMs:100,firstUsefulMs:250,spans:[{name:'decode',startMs:0,endMs:100,durationMs:100}]});
 assert.equal(a.firstUsefulMs,100);assert.equal(a.beforeFirstUsefulMs,100);assert.equal(a.afterFirstUsefulMs,0);assert.ok(a.warnings.includes('FIRST_USEFUL_OUT_OF_RANGE'));
});


test('out of range first useful timing degrades instrumentation health',()=>{
 const a=analyzeCriticalPath({totalMs:100,firstUsefulMs:101,spans:[{name:'decode',startMs:0,endMs:100,durationMs:100}]});
 assert.equal(a.instrumentationHealth,'degraded');
});


test('optimization target prefers actionable leaf before first useful over parent wrapper',()=>{
 const a=analyzeCriticalPath({totalMs:500,firstUsefulMs:300,spans:[
  {name:'ocr',startMs:0,endMs:400,durationMs:400},{name:'decode',startMs:0,endMs:120,durationMs:120},{name:'recognition',startMs:120,endMs:300,durationMs:180}
 ]});
 assert.equal(a.optimizationTarget.name,'recognition');assert.equal(a.preUsefulActionable[0].name,'recognition');
});


test('trace resists regressing clocks without emitting negative timings',()=>{
 let t=100;const x=createCriticalPathTrace({startedAt:100,now:()=>t});x.start('decode');t=90;const span=x.end('decode');
 const snap=x.snapshot({completedAt:80});assert.equal(span.durationMs,0);assert.equal(span.startMs,0);assert.equal(span.endMs,0);assert.equal(span.meta.clockRegression,true);assert.equal(snap.totalMs,0);
});


test('positive-duration malformed geometry cannot enter bottleneck ranking',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'bad',startMs:-20,endMs:80,durationMs:100},{name:'ok',startMs:0,endMs:40,durationMs:40}]});
 assert.equal(a.bottleneck.name,'ok');assert.equal(a.malformedCount,1);
});

test('duration inconsistent with span geometry is treated as malformed',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'inflated',startMs:0,endMs:20,durationMs:90},{name:'ok',startMs:20,endMs:50,durationMs:30}]});
 assert.equal(a.bottleneck.name,'ok');assert.equal(a.malformedCount,1);
});

test('malformed nested child cannot erase parent exclusive time',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'parent',startMs:0,endMs:100,durationMs:100},{name:'bad-child',startMs:10,endMs:90,durationMs:999}]});
 assert.equal(a.actionableBottleneck.name,'parent');assert.equal(a.actionableBottleneck.exclusiveMs,100);
});

test('malformed repeated decode does not create false repeated-decode warning',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'image_decode',startMs:0,endMs:20,durationMs:20},{name:'image_decode',startMs:-5,endMs:10,durationMs:15}]});
 assert.equal(a.warnings.includes('REPEATED_IMAGE_DECODE'),false);
});

test('span extending beyond observed trace is excluded and explicitly reported',()=>{
 const a=analyzeCriticalPath({totalMs:100,spans:[{name:'late',startMs:80,endMs:140,durationMs:60},{name:'ok',startMs:0,endMs:50,durationMs:50}]});
 assert.equal(a.bottleneck.name,'ok');assert.equal(a.outOfRangeCount,1);assert.ok(a.warnings.includes('OUT_OF_RANGE_TIMING_SPANS'));assert.equal(a.instrumentationHealth,'degraded');
});


test('missing first useful mark stays unknown instead of becoming zero milliseconds',()=>{
 const a=analyzeCriticalPath({totalMs:500,firstUsefulMs:null,spans:[{name:'decode',startMs:0,endMs:100,durationMs:100}]});
 assert.equal(a.firstUsefulMs,null);assert.equal(a.beforeFirstUsefulMs,null);assert.equal(a.afterFirstUsefulMs,null);
 assert.deepEqual(a.preUsefulSpans,[]);
});

test('external duration older than trace is clamped without creating malformed telemetry',()=>{
 let t=100;const x=createCriticalPathTrace({startedAt:100,now:()=>t});t=130;x.record('recognition',80);
 const snap=x.snapshot({completedAt:130});const span=snap.spans[0];
 assert.equal(span.startMs,0);assert.equal(span.endMs,30);assert.equal(span.durationMs,30);
 assert.equal(span.meta.externalDurationMs,80);assert.equal(span.meta.clampedToTrace,true);
 const a=analyzeCriticalPath(snap);assert.equal(a.malformedCount,0);assert.equal(a.bottleneck.name,'recognition');
});

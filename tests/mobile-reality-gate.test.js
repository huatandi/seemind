import test from 'node:test';
import assert from 'node:assert/strict';
import {collectBenchmarkDeviceProfile} from '../core/perception/lab/device-benchmark-profile.js';
import {BenchmarkSession} from '../core/perception/lab/benchmark-session.js';
import {evaluateMobileReality} from '../core/perception/lab/mobile-reality-gate.js';

test('benchmark device tier matches production policy for iPhone with hidden RAM',()=>{
 const env={navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari',hardwareConcurrency:6}};
 const p=collectBenchmarkDeviceProfile(env);
 assert.equal(p.mobile,true);
 assert.equal(p.tier,'balanced');
 assert.equal(p.uncertainty.mobileMemoryUnknown,true);
 assert.equal(p.budgets.maxVisualMemoryMb,256);
});

test('benchmark session records first-useful, memory and budget-overrun summary',()=>{
 const s=new BenchmarkSession({engineId:'v',modality:'vision',deviceProfile:{tier:'balanced'}});
 s.record({ok:true,quality:.9,latencyMs:1000,firstUsefulMs:500,memoryDeltaMb:80,budgetExceeded:false});
 s.record({ok:true,quality:.8,latencyMs:5000,firstUsefulMs:1800,memoryDeltaMb:300,budgetExceeded:true});
 const x=s.finish().summary;
 assert.equal(x.p95FirstUsefulMs,500);
 assert.equal(x.budgetExceededRate,.5);
 assert.equal(x.p95MemoryDeltaMb,80);
});

test('mobile reality gate holds a visually accurate model that is too memory-heavy',()=>{
 const session={summary:{successRate:.98,avgQuality:.9,p95LatencyMs:2500,p95FirstUsefulMs:900,budgetExceededRate:.05,p95MemoryDeltaMb:320}};
 const x=evaluateMobileReality({session,deviceProfile:{tier:'balanced',mobile:true,budgets:{maxVisualMemoryMb:256}}});
 assert.equal(x.passed,false);
 assert.ok(x.failures.includes('MEMORY_PRESSURE'));
 assert.equal(x.recommendation,'PREFER_LIGHTER_LOCAL_OR_TEACHER');
});

test('mobile reality gate promotes only when quality, latency and resource budgets all pass',()=>{
 const session={summary:{successRate:.96,avgQuality:.86,p95LatencyMs:2800,p95FirstUsefulMs:900,budgetExceededRate:.04,p95MemoryDeltaMb:120}};
 const x=evaluateMobileReality({session,deviceProfile:{tier:'balanced',mobile:true,budgets:{maxVisualMemoryMb:256}}});
 assert.equal(x.passed,true);
 assert.equal(x.recommendation,'PROMOTE_LOCAL');
});

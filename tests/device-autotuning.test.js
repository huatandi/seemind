import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDeviceProfile} from '../core/device/device-profile.js';
import {VisualBenchmarkStore,deviceBenchmarkKey} from '../core/vision/benchmark/visual-benchmark-store.js';
import {scoreBenchmark,tuneVisualPolicy,shouldUseProvider} from '../core/vision/benchmark/visual-autotuner.js';
import {VisualProvider} from '../core/vision/providers/visual-provider.js';
import {rankVisualProviders} from '../core/vision/providers/visual-provider-router.js';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';

class P extends VisualProvider{
  constructor(id,opts={}){super(id,opts);this.delay=opts.delay??0;this.fail=opts.fail??false}
  async analyze(){if(this.delay)await new Promise(r=>setTimeout(r,this.delay));if(this.fail)throw Object.assign(new Error('FAIL'),{code:'FAIL'});return {kind:'general_vision',providerId:this.id,identity:[],scene:[],regions:[],states:[],relationships:[],anomalies:[],confidence:.8,limitations:[]}}
}

test('device profile classifies constrained mobile hardware as low_power',()=>{
  const p=detectDeviceProfile({navigator:{hardwareConcurrency:4,deviceMemory:2,userAgent:'Android Mobile',connection:{effectiveType:'4g',saveData:false}}});
  assert.equal(p.tier,'low_power');
  assert.equal(p.mobile,true);
  assert.equal(p.budgets.maxVisualMemoryMb,160);
});

test('device profile recognizes high capability WebGPU hardware',()=>{
  const p=detectDeviceProfile({navigator:{hardwareConcurrency:12,deviceMemory:8,userAgent:'Desktop',gpu:{}}});
  assert.equal(p.tier,'performance');
  assert.equal(p.webgpu,true);
  assert.ok(p.budgets.maxVisualMemoryMb>=700);
});

test('benchmark store separates provider results by device key and capability',()=>{
  const s=new VisualBenchmarkStore({storageKey:'test'});
  s.clear();
  s.record('p','object_identity',{ok:true,loadMs:100,inferenceMs:500},{deviceKey:'a'});
  s.record('p','scene_context',{ok:false,inferenceMs:2000,errorCode:'X'},{deviceKey:'a'});
  s.record('p','object_identity',{ok:true,inferenceMs:300},{deviceKey:'b'});
  assert.equal(s.get('p','object_identity','a').successes,1);
  assert.equal(s.get('p','scene_context','a').failures,1);
  assert.equal(s.get('p','object_identity','b').avgInferenceMs,300);
});

test('repeated timeout benchmark becomes avoid recommendation',()=>{
  const profile=detectDeviceProfile({navigator:{hardwareConcurrency:8,deviceMemory:8,gpu:{}}});
  const b={runs:3,successes:0,failures:3,timeouts:3,avgInferenceMs:10000};
  const x=scoreBenchmark(b,profile);
  assert.equal(x.recommendation,'avoid');
});

test('fast reliable provider becomes preferred after enough runs',()=>{
  const profile=detectDeviceProfile({navigator:{hardwareConcurrency:8,deviceMemory:8,gpu:{}}});
  const b={runs:4,successes:4,failures:0,timeouts:0,avgInferenceMs:900};
  const x=scoreBenchmark(b,profile);
  assert.equal(x.recommendation,'preferred');
});

test('low power policy blocks heavy provider before inference',()=>{
  const profile=detectDeviceProfile({navigator:{hardwareConcurrency:4,deviceMemory:2}});
  const heavy=new P('heavy',{capabilities:['object_identity'],estimatedMemoryMb:300,deviceClasses:['low_power','balanced','performance']});
  const policy=tuneVisualPolicy({profile,benchmarks:[],providers:[heavy]});
  assert.equal(shouldUseProvider(heavy,{policy,capability:'object_identity'}).use,false);
});

test('provider ranking skips benchmark-avoid provider',async()=>{
  const a=new P('bad',{capabilities:['object_identity'],estimatedMemoryMb:50,reliability:1});
  const b=new P('good',{capabilities:['object_identity'],estimatedMemoryMb:50,reliability:.6});
  const policy={heavyAllowed:true,providerPolicy:{bad:{recommendation:'avoid'},good:{recommendation:'allowed'}}};
  const ranked=await rankVisualProviders({providers:[a,b],requiredCapabilities:['object_identity'],deviceClass:'balanced',deviceBudget:{maxMemoryMb:300},autotunePolicy:policy});
  assert.deepEqual(ranked.map(x=>x.provider.id),['good']);
});

test('executor records real inference benchmark result',async()=>{
  const store=new VisualBenchmarkStore({storageKey:'test2'});store.clear();
  const p=new P('p',{capabilities:['object_identity'],estimatedMemoryMb:20,delay:5});
  const r=await executeVisualCapabilities({image:{},capabilities:['object_identity'],providers:[p],deviceClass:'balanced',deviceBudget:{maxMemoryMb:100},benchmarkStore:store,deviceBenchmarkKey:'dev'});
  assert.equal(r.results[0].status,'ok');
  const b=store.get('p','object_identity','dev');
  assert.equal(b.successes,1);
  assert.ok(b.avgInferenceMs>=0);
});

test('device benchmark key is stable for same profile',()=>{
  const p={tier:'balanced',cores:8,memoryGb:4,webgpu:false,mobile:false};
  assert.equal(deviceBenchmarkKey(p),deviceBenchmarkKey({...p}));
});

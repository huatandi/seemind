import {detectDeviceProfile} from '../core/device/device-profile.js';
import {VisualBenchmarkStore,deviceBenchmarkKey} from '../core/vision/benchmark/visual-benchmark-store.js';
import {tuneVisualPolicy} from '../core/vision/benchmark/visual-autotuner.js';
import {VisualProvider} from '../core/vision/providers/visual-provider.js';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';

class P extends VisualProvider{
  constructor(id,opts={}){super(id,opts);this.delay=opts.delay??0;this.fail=opts.fail??false}
  async analyze(){if(this.delay)await new Promise(r=>setTimeout(r,this.delay));if(this.fail)throw Object.assign(new Error('LAB_FAIL'),{code:'LAB_FAIL'});return {kind:'general_vision',providerId:this.id,identity:[],scene:[],regions:[],states:[],relationships:[],anomalies:[],confidence:.8,limitations:[]}}
}
const profile=detectDeviceProfile({navigator:{hardwareConcurrency:8,deviceMemory:8,userAgent:'Desktop',gpu:{}}});
const key=deviceBenchmarkKey(profile);
const store=new VisualBenchmarkStore({storageKey:'lab'});
store.clear();
const fast=new P('fast',{capabilities:['object_identity'],estimatedMemoryMb:120,estimatedLatencyMs:600,reliability:.9});
const bad=new P('bad',{capabilities:['object_identity'],estimatedMemoryMb:120,estimatedLatencyMs:600,reliability:.9,fail:true});
for(let i=0;i<3;i++){
  await executeVisualCapabilities({image:{i},capabilities:['object_identity'],providers:[bad,fast],deviceClass:profile.tier,deviceBudget:{maxMemoryMb:profile.budgets.maxVisualMemoryMb},benchmarkStore:store,deviceBenchmarkKey:key,timeoutMs:100});
}
const policy=tuneVisualPolicy({profile,benchmarks:store.list({deviceKey:key}),providers:[bad,fast]});
const checks=[
 profile.tier==='performance',
 store.get('bad','object_identity',key).failures>=1,
 store.get('fast','object_identity',key).successes>=1,
 policy.providerPolicy.fast.recommendation!=='avoid',
 policy.providerPolicy.bad.recommendation==='avoid',
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Visual Benchmark & Device Autotuning Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),profile,benchmarks:store.list({deviceKey:key}),policy},null,2));
if(passed!==checks.length)process.exitCode=1;

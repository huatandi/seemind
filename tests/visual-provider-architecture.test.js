import test from 'node:test';
import assert from 'node:assert/strict';
import {VisualProvider} from '../core/vision/providers/visual-provider.js';
import {VisualProviderRegistry} from '../core/vision/providers/visual-provider-registry.js';
import {VisualProviderPerformanceStore} from '../core/vision/providers/visual-provider-performance.js';
import {rankVisualProviders} from '../core/vision/providers/visual-provider-router.js';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';

class MockProvider extends VisualProvider{
 constructor(id,opts={}){super(id,opts);this.fail=opts.fail??false;this.output=opts.output??{ok:true}}
 async analyze(_image,request){if(this.fail)throw Object.assign(new Error('MOCK_FAIL'),{code:'MOCK_FAIL'});return {...this.output,request}}
}

test('registry accepts pluggable visual providers and rejects duplicates',()=>{
 const a=new MockProvider('a',{capabilities:['object_identity']});
 const r=new VisualProviderRegistry([a]);
 assert.equal(r.get('a'),a);
 assert.throws(()=>r.register(a),/DUPLICATE_VISUAL_PROVIDER/);
});

test('registry selects by capability, device class, privacy and memory budget',()=>{
 const low=new MockProvider('low',{capabilities:['object_identity'],deviceClasses:['low_power','balanced'],estimatedMemoryMb:120,privacyModes:['local']});
 const heavy=new MockProvider('heavy',{capabilities:['object_identity'],deviceClasses:['performance'],estimatedMemoryMb:1200,privacyModes:['local']});
 const cloud=new MockProvider('cloud',{providerType:'cloud',capabilities:['object_identity'],privacyModes:['cloud']});
 const r=new VisualProviderRegistry([low,heavy,cloud]);
 assert.deepEqual(r.select({requiredCapabilities:['object_identity'],deviceClass:'low_power',maxMemoryMb:256,localOnly:true}).map(x=>x.id),['low']);
});

test('router prefers better capability fit and reliability',async()=>{
 const p1=new MockProvider('p1',{capabilities:[{capability:'object_identity',score:.95}],estimatedLatencyMs:1800,reliability:.9});
 const p2=new MockProvider('p2',{capabilities:[{capability:'object_identity',score:.75}],estimatedLatencyMs:600,reliability:.7});
 const ranked=await rankVisualProviders({providers:[p2,p1],requiredCapabilities:['object_identity'],deviceBudget:{maxMemoryMb:512}});
 assert.equal(ranked[0].provider.id,'p1');
});

test('router excludes provider that cannot fit device memory',async()=>{
 const heavy=new MockProvider('heavy',{capabilities:['general_vision'],estimatedMemoryMb:1500,reliability:1});
 const ranked=await rankVisualProviders({providers:[heavy],requiredCapabilities:['general_vision'],deviceBudget:{maxMemoryMb:512}});
 assert.equal(ranked.length,0);
});

test('performance history can reduce ranking of repeatedly failing provider',async()=>{
 const store=new VisualProviderPerformanceStore();
 const fast=new MockProvider('fast',{capabilities:['object_identity'],estimatedLatencyMs:500,reliability:.9});
 const stable=new MockProvider('stable',{capabilities:['object_identity'],estimatedLatencyMs:1800,reliability:.8});
 for(let i=0;i<5;i++)store.recordFailure('fast',{latencyMs:400,capabilities:['object_identity']});
 for(let i=0;i<5;i++)store.recordSuccess('stable',{latencyMs:1500,capabilities:['object_identity']});
 const ranked=await rankVisualProviders({providers:[fast,stable],requiredCapabilities:['object_identity'],performanceStore:store,deviceBudget:{maxMemoryMb:512}});
 assert.equal(ranked[0].provider.id,'stable');
});

test('executor falls back to next provider after local provider failure',async()=>{
 const fail=new MockProvider('fail',{priority:100,capabilities:['color_state'],fail:true});
 const ok=new MockProvider('ok',{priority:50,capabilities:['color_state'],output:{state:'red'}});
 const r=await executeVisualCapabilities({image:{},capabilities:['color_state'],providers:[fail,ok],deviceBudget:{maxMemoryMb:512}});
 assert.equal(r.results[0].status,'ok');
 assert.equal(r.results[0].providerId,'ok');
 assert.equal(r.failures[0].providerId,'fail');
 assert.equal(r.escalation.needed,false);
});

test('executor escalates only unresolved visual capabilities',async()=>{
 const identity=new MockProvider('identity',{capabilities:['object_identity'],output:{label:'motor'}});
 const r=await executeVisualCapabilities({image:{},capabilities:['object_identity','anomaly_inspection'],providers:[identity],deviceBudget:{maxMemoryMb:512}});
 assert.equal(r.results.find(x=>x.capability==='object_identity').status,'ok');
 assert.equal(r.results.find(x=>x.capability==='anomaly_inspection').status,'unresolved');
 assert.deepEqual(r.escalation.unresolvedCapabilities,['anomaly_inspection']);
});

test('executor records provider performance independently by capability',async()=>{
 const store=new VisualProviderPerformanceStore();
 const p=new MockProvider('p',{capabilities:['object_identity','scene_context']});
 await executeVisualCapabilities({image:{},capabilities:['object_identity','scene_context'],providers:[p],performanceStore:store,deviceBudget:{maxMemoryMb:512}});
 const snap=store.get('p');
 assert.equal(snap.successes,2);
 assert.equal(snap.capabilities.object_identity.successes,1);
 assert.equal(snap.capabilities.scene_context.successes,1);
});

test('provider profile is vendor-neutral and declares capabilities explicitly',()=>{
 const p=new MockProvider('vision-a',{version:'1',providerType:'local',capabilities:['object_identity','scene_context'],estimatedMemoryMb:256});
 const profile=p.getProfile();
 assert.equal(profile.id,'vision-a');
 assert.deepEqual(profile.capabilities.map(x=>x.capability),['object_identity','scene_context']);
 assert.equal('vendor' in profile,false);
});

test('no provider produces unresolved result rather than fake vision output',async()=>{
 const r=await executeVisualCapabilities({image:{},capabilities:['general_vision'],providers:[],deviceBudget:{maxMemoryMb:512}});
 assert.equal(r.results[0].status,'unresolved');
 assert.equal(r.results[0].output,null);
 assert.equal(r.escalation.needed,true);
});

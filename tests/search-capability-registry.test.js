import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultSearchCapabilityRegistry,executeSearchCapabilitySelection,SEARCH_CAPABILITIES} from '../core/retrieval/search-capability-registry.js';
import {planKnowledgeRetrieval} from '../core/retrieval/knowledge-retrieval-router.js';
import {createWebCapabilityExecutors} from '../apps/web/src/runtime/web-capability-executors.js';

const provider=name=>({search:async req=>({evidence:[{id:name,type:'search',url:`https://${name}.example/a`,title:name}],meta:{provider:name,query:req.query}})});

test('product/manual task prefers manual capability over generic web',()=>{
 const registry=createDefaultSearchCapabilityRegistry({webProvider:provider('web'),manualProvider:provider('manual'),productProvider:provider('product')});
 const plan={preferredSources:['manufacturer','manual','reputable_web'],needsAuthority:true,needsFreshness:false,needsImageSearch:false};
 const s=registry.select({plan,worldDomain:{primary:'product'}});
 assert.equal(s.primary.type,SEARCH_CAPABILITIES.MANUAL);
 assert.ok(s.fallbacks.some(x=>x.type===SEARCH_CAPABILITIES.WEB));
});

test('visual identification prefers image search when available',()=>{
 const registry=createDefaultSearchCapabilityRegistry({webProvider:provider('web'),imageProvider:provider('images')});
 const s=registry.select({plan:{preferredSources:['image_search','reputable_web'],needsImageSearch:true},worldDomain:{primary:'plant'}});
 assert.equal(s.primary.type,SEARCH_CAPABILITIES.IMAGE);
});

test('place/find task prefers maps-local capability',()=>{
 const registry=createDefaultSearchCapabilityRegistry({webProvider:provider('web'),localProvider:provider('maps')});
 const s=registry.select({plan:{preferredSources:['maps_or_local_source','current_web'],needsFreshness:true},worldDomain:{primary:'place'},intentGraph:{intents:[{intent:'find'}]}});
 assert.equal(s.primary.type,SEARCH_CAPABILITIES.LOCAL);
});

test('authority task prefers official source when available',()=>{
 const registry=createDefaultSearchCapabilityRegistry({webProvider:provider('web'),officialProvider:provider('official')});
 const s=registry.select({plan:{preferredSources:['official_source','reputable_web'],needsAuthority:true},worldDomain:{primary:'finance'}});
 assert.equal(s.primary.type,SEARCH_CAPABILITIES.OFFICIAL);
});

test('registry falls back when primary provider fails',async()=>{
 const bad={search:async()=>{throw Object.assign(new Error('down'),{code:'DOWN'})}};
 const good=provider('web');
 const registry=createDefaultSearchCapabilityRegistry({officialProvider:bad,webProvider:good});
 const selection=registry.select({plan:{preferredSources:['official_source','reputable_web'],needsAuthority:true},worldDomain:{primary:'finance'}});
 const r=await executeSearchCapabilitySelection({selection,registry,request:{query:'tax rule'}});
 assert.equal(r.status,'completed');assert.equal(r.capability.type,SEARCH_CAPABILITIES.WEB);assert.equal(r.attempts.length,2);
});

test('retrieval planner exposes capability needs instead of only generic SEARCH',()=>{
 const p=planKnowledgeRetrieval({
   observation:{detectedType:'product',confidence:{overall:.4},observations:[]},
   problem:{userQuestion:'这个型号的说明书是什么？',problemSignals:[]},
   worldDomain:{primary:'product'},intentGraph:{intents:[{intent:'identify'}],userText:'说明书'},
   safetyRisk:{level:'R0'},searchAvailable:true
 });
 assert.equal(p.shouldSearch,true);
 assert.equal(p.capabilityNeeds.product,true);
 assert.ok(p.capabilityNeeds.preferredSourceTypes.includes('manual'));
});

test('web executor uses specialized manual provider selected by registry',async()=>{
 let pkg={task:{type:'question',domain:'product'},worldDomain:{primary:'product'},search:{required:false},evidence:[]};
 const used=[];
 const executors=createWebCapabilityExecutors({
  getTaskPackage:()=>pkg,setTaskPackage:v=>{pkg=v},getObservation:()=>({observations:[]}),getVisionAttachment:()=>null,getConversation:()=>[],getProviders:()=>[],
  getSearchProvider:()=>provider('web'),
  getSearchCapabilities:()=>({manualProvider:{search:async req=>{used.push(['manual',req.query]);return {evidence:[]}}},productProvider:provider('product')}),
  getVerifiedEntity:()=>null,setVerifiedEntity:()=>{},getPendingExecution:()=>null,setPendingExecution:()=>{},searchPrivacyPolicy:{}
 });
 const r=await executors.SEARCH({contract:{details:{queries:['KIA manual model'],preferredSources:['manual','manufacturer','reputable_web'],needsAuthority:true,retrievalPlan:{preferredSources:['manual','manufacturer','reputable_web'],needsAuthority:true}}}});
 assert.ok(['completed','failed'].includes(r.status));assert.equal(used[0][0],'manual');
 assert.equal(r.taskPackage.search.capabilitySelection.primary.type,'manual_documentation');
});

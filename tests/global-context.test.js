import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGlobalContext,effectiveRegion,mergeGlobalContext} from '../core/global/global-context.js';
import {buildUniversalStructuredFacts} from '../core/facts/universal-facts.js';
import {normalizeOcrText} from '../core/ocr/ocr-normalizer.js';
import {SearchCapabilityRegistry} from '../core/retrieval/search-capability-registry.js';

test('user region, object region and question region remain distinct',()=>{
 const c=resolveGlobalContext({
  task:{userIntent:'这个日本产品按照美国规定能不能保修？',language:'zh'},
  entity:{region:'JP'},
  userEnvironment:{region:'MX',locale:'zh-CN',timezone:'America/Tijuana'},
 });
 assert.equal(c.userRegion,'MX');assert.equal(c.objectRegion,'JP');assert.equal(c.questionRegion,'US');
 assert.equal(effectiveRegion(c,'product'),'JP');assert.equal(effectiveRegion(c,'law'),'US');
 assert.ok(c.conflicts.some(x=>x.type==='multi_region_context'));
});

test('browser/user region does not become jurisdiction by default',()=>{
 const c=resolveGlobalContext({task:{userIntent:'这是什么？'},userEnvironment:{region:'MX',locale:'es-MX'}});
 assert.equal(c.userRegion,'MX');assert.equal(c.questionRegion,null);assert.equal(c.jurisdiction,null);
});

test('explicit question country outranks user location for official-source purpose',()=>{
 const c=resolveGlobalContext({task:{userIntent:'日本进口规定是什么？'},userEnvironment:{region:'US'}});
 assert.equal(effectiveRegion(c,'official_source'),'JP');
});

test('global context can merge later evidence without destroying user region',()=>{
 const a=resolveGlobalContext({task:{userIntent:'what is this'},userEnvironment:{region:'CA'}});
 const b=mergeGlobalContext(a,{objectRegion:'DE',questionRegion:'FR'});
 assert.equal(b.userRegion,'CA');assert.equal(b.objectRegion,'DE');assert.equal(b.questionRegion,'FR');
});

test('universal money facts are not hardcoded to MXN',()=>{
 const facts=buildUniversalStructuredFacts({receiptType:{type:'retail'},total:{value:1234,confidence:1}},{currency:'JPY'});
 assert.equal(facts.index['money.total'].unit,'JPY-minor');
});

test('OCR normalizer has no Mexico locale default',()=>{
 const r=normalizeOcrText('TOTAL 10.00');
 assert.equal(r.locale,null);
});

test('provider registry may prefer a provider matching target jurisdiction without hardcoding provider names',()=>{
 const mk=(id,regions)=>({id,type:'official_source',provider:{search:async()=>({})},available:true,priority:50,domains:['*'],sourceTypes:['official_source'],regions});
 const registry=new SearchCapabilityRegistry({capabilities:[mk('global',['*']),mk('jp-official',['JP'])]});
 const s=registry.select({plan:{preferredSources:['official_source'],needsAuthority:true},worldDomain:{primary:'general'},globalContext:{jurisdiction:'JP'}});
 assert.equal(s.primary.id,'jp-official');
});

test('same registry can choose another region-specific provider',()=>{
 const mk=(id,regions)=>({id,type:'official_source',provider:{search:async()=>({})},available:true,priority:50,domains:['*'],sourceTypes:['official_source'],regions});
 const registry=new SearchCapabilityRegistry({capabilities:[mk('mx',['MX']),mk('us',['US'])]});
 const s=registry.select({plan:{preferredSources:['official_source'],needsAuthority:true},worldDomain:{primary:'general'},globalContext:{jurisdiction:'US'}});
 assert.equal(s.primary.id,'us');
});

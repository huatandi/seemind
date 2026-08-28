import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeFreshness,applyFreshnessToTask} from '../core/freshness/freshness-engine.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {planSearch} from '../core/search/search-planner.js';
import {searchResultsToEvidence} from '../core/search/search-evidence.js';
import {validateTeacherResult} from '../core/teacher/teacher-result-validator.js';
import {GatewaySearchService} from '../gateway/core/search-service.js';

const obs={schemaVersion:1,modality:'image',extractedText:'KIA SPORTAGE',confidence:{overall:.9},limitations:[],observations:[]};

test('freshness engine marks current price as search-required',()=>{const f=analyzeFreshness('这个现在多少钱？');assert.equal(f.required,true);assert.ok(['LIVE','FAST_CHANGING'].includes(f.freshnessClass));});
test('static explanation does not force web search',()=>{const f=analyzeFreshness('解释一下 subtotal 和 IVA 的区别');assert.equal(f.required,false);});
test('task keeps Teacher reasoning separate from external web search capability',()=>{const t=applyFreshnessToTask({type:'question_about_observation',userIntent:'现在多少钱',requiredCapabilities:['reasoning']});assert.equal(t.webSearchRequired,true);assert.deepEqual(t.requiredCapabilities,['reasoning']);assert.ok(t.externalCapabilities.includes('web_search'));});
test('compiled package contains explicit search plan',()=>{const p=compileTaskPackage({task:{type:'question_about_observation',userIntent:'现在多少钱',requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});assert.equal(p.search.required,true);assert.equal(p.freshness.required,true);});
test('search result becomes timestamped evidence',()=>{const rows=searchResultsToEvidence([{title:'Store',url:'https://example.test/p',snippet:'MXN 100'}],{requestId:'r',freshnessClass:'FAST_CHANGING'});assert.equal(rows[0].type,'search');assert.ok(rows[0].accessedAt);assert.equal(rows[0].id,'search-r-1');});
test('fresh factual claim cannot cite only image when current evidence is required',()=>{const p=compileTaskPackage({task:{type:'question_about_observation',userIntent:'现在多少钱',requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});p.media=[{id:'img-1',type:'image'}];const r=validateTeacherResult({answer:'现在价格 100',claims:[{id:'c',text:'当前价格是100',type:'price',status:'supported',confidence:.9,evidenceRefs:['img-1']}]},p);assert.equal(r.ok,false);assert.ok(r.issues.some(x=>x.startsWith('freshness_evidence_missing:')));});
test('fresh search evidence can support current price claim',()=>{const p=compileTaskPackage({task:{type:'question_about_observation',userIntent:'现在多少钱',requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});p.evidence.push(...searchResultsToEvidence([{title:'Store',url:'https://example.test/p',snippet:'MXN 100'}],{requestId:'r',freshnessClass:'FAST_CHANGING'}));const r=validateTeacherResult({answer:'现在价格 100',claims:[{id:'c',text:'当前价格是100',type:'price',status:'supported',confidence:.9,evidenceRefs:['search-r-1']}]},p);assert.equal(r.ok,true);});
test('gateway search is explicit and returns no secret metadata',async()=>{const fetchImpl=async()=>({ok:true,json:async()=>({results:[{title:'A',url:'https://a.test',snippet:'x'}]})});const s=new GatewaySearchService({config:{enabled:true,endpoint:'https://search.test',apiKey:'SECRET',publicName:'search-A'},fetchImpl});const r=await s.search({requestId:'q1',plan:{query:'current price',maxResults:5}});assert.equal(r.results.length,1);assert.equal(r.meta.provider,'search-A');assert.equal(JSON.stringify(r).includes('SECRET'),false);});

test('search plan carries safe task context for task-specific source ranking',()=>{
  const p=compileTaskPackage({task:{type:'price_search',userIntent:'现在多少钱',webSearchRequired:true},observation:obs,userIntent:'现在多少钱'});p.identity={...p.identity,required:false,ok:true};p.search={...p.search,blocked:false};
  assert.equal(p.search.taskContext.type,'price_search');assert.equal(p.search.taskContext.userIntent,'现在多少钱');
});

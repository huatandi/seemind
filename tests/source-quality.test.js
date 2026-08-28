import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySource,sourceQualityForTask,rankEvidenceForTask,minimumSourceScore} from '../core/evidence/source-quality.js';
import {searchResultsToEvidence} from '../core/search/search-evidence.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {validateTeacherResult} from '../core/teacher/teacher-result-validator.js';

const obs={schemaVersion:1,modality:'image',extractedText:'PRODUCT',confidence:{overall:.9},limitations:[],observations:[]};

test('government source is recognized as high-authority',()=>{const e={url:'https://www.gob.mx/inm',publisher:'Gobierno de México'};assert.equal(classifySource(e),'government');assert.ok(sourceQualityForTask(e,{type:'legal_research',userIntent:'最新移民规定'}).score>.8);});
test('retailer is preferred over generic web for current price',()=>{const task={type:'price_search',userIntent:'现在多少钱'};const ranked=rankEvidenceForTask([{id:'w',type:'search',url:'https://blog.example/x',title:'article',credibility:.7,relevance:.8},{id:'r',type:'search',url:'https://shop.example/p',title:'Official Store price',publisher:'Store',credibility:.7,relevance:.8}],task);assert.equal(ranked[0].id,'r');});
test('community source stays usable but weak for product specification',()=>{const q=sourceQualityForTask({url:'https://reddit.com/r/test',credibility:.6,relevance:.8},{type:'manual_lookup',userIntent:'兼容规格'});assert.ok(q.score<minimumSourceScore({type:'manual_lookup',userIntent:'兼容规格'}));});
test('search evidence carries source quality metadata',()=>{const [e]=searchResultsToEvidence([{title:'Store',url:'https://shop.example/p',snippet:'MXN 100'}],{requestId:'q',task:{type:'price_search',userIntent:'价格'}});assert.ok(e.sourceQuality?.score>0);assert.ok(e.sourceQuality?.sourceType);});
test('fresh current claim is rejected when cited search source quality is too low',()=>{const p=compileTaskPackage({task:{type:'price_search',userIntent:'现在多少钱',webSearchRequired:true,requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});p.identity={...p.identity,required:false,ok:true};p.evidence=[{id:'bad',type:'search',url:'https://reddit.com/r/x',title:'community',snippet:'maybe 100',accessedAt:new Date().toISOString(),credibility:.2,relevance:.4}];const r=validateTeacherResult({answer:'100',claims:[{id:'c',text:'当前价格100',type:'price',status:'supported',confidence:.9,evidenceRefs:['bad']}]},p);assert.equal(r.ok,false);assert.ok(r.issues.includes('source_quality_insufficient:c'));});
test('fresh retailer source can support current price',()=>{const p=compileTaskPackage({task:{type:'price_search',userIntent:'现在多少钱',webSearchRequired:true,requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});p.identity={...p.identity,required:false,ok:true};p.evidence=[{id:'good',type:'search',url:'https://shop.example/p',title:'Store',publisher:'Store',snippet:'100',accessedAt:new Date().toISOString(),credibility:.8,relevance:.9}];const r=validateTeacherResult({answer:'100',claims:[{id:'c',text:'当前价格100',type:'price',status:'supported',confidence:.9,evidenceRefs:['good']}]},p);assert.equal(r.ok,true);});
import {analyzeEvidenceSet} from '../core/evidence/source-quality.js';

test('evidence set counts independent origins instead of duplicate pages',()=>{const a=analyzeEvidenceSet([{url:'https://a.example/p1',publisher:'A'},{url:'https://a.example/p2',publisher:'A'},{url:'https://b.example/p',publisher:'B'}],{});assert.equal(a.independentOrigins,2);assert.equal(a.independentPublishers,2);});
test('explicit conflicting source values are detected',()=>{const a=analyzeEvidenceSet([{url:'https://shop1.example/p',claimKey:'price_mxn',claimValue:100},{url:'https://shop2.example/p',claimKey:'price_mxn',claimValue:120}],{type:'price_search'});assert.equal(a.hasConflict,true);assert.equal(a.conflicts[0].claimKey,'price_mxn');});
test('claim judge blocks explicitly conflicting current evidence',()=>{const p=compileTaskPackage({task:{type:'price_search',userIntent:'现在多少钱',webSearchRequired:true,requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});p.identity={...p.identity,required:false,ok:true};p.evidence=[{id:'p1',type:'search',url:'https://shop1.example/p',title:'Store 1',publisher:'Store',accessedAt:new Date().toISOString(),credibility:.9,relevance:.9,claimKey:'price_mxn',claimValue:100},{id:'p2',type:'search',url:'https://shop2.example/p',title:'Store 2',publisher:'Store',accessedAt:new Date().toISOString(),credibility:.9,relevance:.9,claimKey:'price_mxn',claimValue:120}];const r=validateTeacherResult({answer:'100',claims:[{id:'c',text:'当前价格100',type:'price',status:'supported',confidence:.9,evidenceRefs:['p1','p2']}]},p);assert.equal(r.ok,false);assert.ok(r.issues.includes('source_conflict:c'));});

import {analyzeConsensus,evidenceFamily} from '../core/evidence/evidence-consensus.js';

test('syndicated pages with same upstream source count as one evidence family',()=>{
  const now=new Date().toISOString();
  const a=analyzeConsensus([
    {id:'a',url:'https://news-a.example/x',publisher:'News A',sourceGroup:'agency-x',claimKey:'rule',claimValue:'yes',accessedAt:now,credibility:.9,relevance:.9},
    {id:'b',url:'https://news-b.example/x',publisher:'News B',sourceGroup:'agency-x',claimKey:'rule',claimValue:'yes',accessedAt:now,credibility:.9,relevance:.9},
  ],{});
  assert.equal(a.independentFamilies,1);
  assert.equal(evidenceFamily({sourceGroup:'Agency-X'}),'declared:agency-x');
});

test('two genuinely independent agreeing sources produce consensus',()=>{
  const now=new Date().toISOString();
  const a=analyzeConsensus([
    {id:'a',url:'https://shop-a.example/p',publisher:'Store A',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.9,relevance:.9,isPrimarySource:true},
    {id:'b',url:'https://shop-b.example/p',publisher:'Store B',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.9,relevance:.9,isPrimarySource:true},
  ],{type:'price_search',userIntent:'价格'});
  assert.equal(a.hasConflict,false);
  assert.equal(a.consensuses[0].independentFamilies,2);
  assert.equal(a.recommendation,'accept_consensus');
});

test('clear authority/directness advantage can resolve a source conflict with caveat',()=>{
  const now=new Date().toISOString();
  const old=new Date(Date.now()-400*86400000).toISOString();
  const a=analyzeConsensus([
    {id:'official',url:'https://manufacturer.example/spec',publisher:'Official Manufacturer',claimKey:'spec',claimValue:'A',publishedAt:now,accessedAt:now,credibility:1,relevance:1,isPrimarySource:true},
    {id:'db',url:'https://database.example/spec',publisher:'Professional Database',title:'Database record',claimKey:'spec',claimValue:'B',publishedAt:old,accessedAt:old,credibility:.6,relevance:.7,isPrimarySource:false},
  ],{type:'manual_lookup',userIntent:'官方规格'});
  assert.equal(a.conflicts.length,1);
  assert.equal(a.conflicts[0].resolution.status,'resolved');
  assert.equal(a.conflicts[0].resolution.preferredValue,'a');
});

test('two close high quality independent conflicts remain unresolved',()=>{
  const now=new Date().toISOString();
  const a=analyzeConsensus([
    {id:'a',url:'https://shop-a.example/p',publisher:'Store A',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.95,relevance:.95,isPrimarySource:true},
    {id:'b',url:'https://shop-b.example/p',publisher:'Store B',claimKey:'price_mxn',claimValue:105,accessedAt:now,credibility:.95,relevance:.95,isPrimarySource:true},
  ],{type:'price_search',userIntent:'当前价格'});
  assert.equal(a.conflicts[0].resolution.status,'unresolved');
  assert.equal(a.recommendation,'search_more_or_report_disagreement');
});

test('claim judge allows decisively resolved fresh conflict but records caveat issue',()=>{
  const p=compileTaskPackage({task:{type:'price_search',userIntent:'现在多少钱',webSearchRequired:true,requiredCapabilities:['reasoning']},observation:obs,userIntent:'现在多少钱'});
  p.identity={...p.identity,required:false,ok:true};
  const now=new Date().toISOString();
  p.evidence=[
    {id:'primary',type:'search',url:'https://shop.example/p',title:'Store',publisher:'Store',accessedAt:now,credibility:1,relevance:1,claimKey:'price_mxn',claimValue:100,isPrimarySource:true},
    {id:'secondary',type:'search',url:'https://article.example/p',title:'Price article',publisher:'Independent Web',accessedAt:now,credibility:.6,relevance:.7,claimKey:'price_mxn',claimValue:120,isPrimarySource:false},
  ];
  const r=validateTeacherResult({answer:'100',claims:[{id:'c',text:'当前价格100',type:'price',status:'supported',confidence:.8,evidenceRefs:['primary','secondary']}]},p);
  assert.equal(r.ok,true);
  assert.ok(r.issues.includes('source_conflict_resolved:c'));
  assert.equal(r.value.claims[0].consensus.conflicts[0].resolution.status,'resolved');
});

test('privacy sanitizer preserves safe evidence-family metadata and consensus summary',async()=>{
  const {sanitizeTaskPackage}=await import('../core/privacy/task-package-sanitizer.js');
  const pkg={evidence:[{id:'s',type:'search',url:'https://example.com',title:'x',sourceGroup:'agency',upstreamSource:'origin',canonicalSource:'canon',isPrimarySource:true}],evidenceConsensus:{independentFamilies:1,recommendation:'single_source_caution',consensuses:[],conflicts:[]}};
  const out=sanitizeTaskPackage(pkg,{allowRawText:false}).package;
  assert.equal(out.evidence[0].sourceGroup,'agency');
  assert.equal(out.evidence[0].isPrimarySource,true);
  assert.equal(out.evidenceConsensus.recommendation,'single_source_caution');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeSearchQuery,buildSafeSearchQueries,assessSearchPrivacy} from '../core/privacy/search-privacy-gate.js';
import {prepareExternalSearchRequest} from '../core/privacy/external-query-policy.js';
import {searchResultsToEvidence} from '../core/search/search-evidence.js';
import {verifyExecutionResult} from '../core/verification/verification-core.js';
import {createResultEnvelope} from '../core/orchestration/result-envelope.js';
import {sanitizeTaskPackage} from '../core/privacy/task-package-sanitizer.js';
import {createWebCapabilityExecutors} from '../apps/web/src/runtime/web-capability-executors.js';

test('search sanitizer removes Mexican RFC, account numbers and email',()=>{
 const q='BBVA transferencia JUAN RFC ABCD8501011A2 cuenta 1234567890123456 correo test@example.com significado';
 const r=sanitizeSearchQuery(q);
 assert.doesNotMatch(r.query,/ABCD8501011A2/);
 assert.doesNotMatch(r.query,/1234567890123456/);
 assert.doesNotMatch(r.query,/test@example\.com/);
 assert.match(r.query,/BBVA|transferencia/);
 assert.ok(r.redactions.length>=3);
});

test('search privacy assessment detects sensitive finance context',()=>{
 const a=assessSearchPrivacy({
   query:'qué significa referencia 1234567890123456',
   task:{},
   worldDomain:{primary:'finance'},
   observation:{extractedText:'RFC ABCD8501011A2'},
 });
 assert.equal(a.sensitive,true);
 assert.equal(a.requiresConsent,true);
});

test('safe-query builder never includes raw OCR payload',()=>{
 const r=buildSafeSearchQueries({
   queries:['explicar transferencia BBVA 1234567890123456'],
   worldDomain:{primary:'finance'},
   observation:{extractedText:'NOMBRE JUAN PEREZ RFC ABCD8501011A2 CLABE 123456789012345678'},
 });
 assert.equal(r.rawOcrIncluded,false);
 assert.doesNotMatch(r.queries.join(' '),/ABCD8501011A2|123456789012345678|1234567890123456/);
});

test('explicit external-search policy can block sensitive search pending consent',()=>{
 const p=prepareExternalSearchRequest({
   queries:['buscar RFC ABCD8501011A2 factura'],
   worldDomain:{primary:'finance'},
   observation:{},
   policy:{requireExplicitConsent:true},
   consent:false,
 });
 assert.equal(p.allowed,false);
 assert.equal(p.reason,'SEARCH_CONSENT_REQUIRED');
});

test('search evidence receives canonical provenance and unknown license by default',()=>{
 const [e]=searchResultsToEvidence([{id:'x',title:'Official',url:'https://example.gov/a',publisher:'Agency',snippet:'fact'}],{
   requestId:'req1',queryFingerprint:'abc123',fetchedVia:'test_search',accessedAt:'2026-08-26T00:00:00Z'
 });
 assert.equal(e.provenance.sourceId,'x');
 assert.equal(e.provenance.hostname,'example.gov');
 assert.equal(e.provenance.queryFingerprint,'abc123');
 assert.equal(e.provenance.license.id,'unknown');
 assert.equal(e.provenance.attributionRequired,true);
});

test('verification verdict carries source provenance rather than bare url only',()=>{
 const [e]=searchResultsToEvidence([{id:'x',title:'Official',url:'https://example.gov/a',publisher:'Agency',snippet:'fact',credibility:1,relevance:1}],{requestId:'r'});
 const env=createResultEnvelope({route:'SEARCH',result:{evidence:[e]},taskPackage:{task:{type:'question'},evidence:[e]}});
 const v=verifyExecutionResult({envelope:env,context:{task:{type:'question'},safety:{risk:{level:'R0'}}}});
 assert.ok(v.provenance.length>=1);
 assert.equal(v.provenance[0].sourceId,'x');
 assert.ok('license' in v.provenance[0]);
});

test('teacher sanitizer preserves safe provenance metadata',()=>{
 const [e]=searchResultsToEvidence([{id:'x',title:'Page',url:'https://example.org/a',publisher:'Publisher',snippet:'hello'}],{requestId:'r'});
 const out=sanitizeTaskPackage({evidence:[e]},{allowRawText:false}).package;
 assert.equal(out.evidence[0].provenance.sourceId,'x');
 assert.equal(out.evidence[0].provenance.url,'https://example.org/a');
});

test('web search executor sends sanitized query to provider',async()=>{
 let pkg={task:{type:'question',domain:'finance'},worldDomain:{primary:'finance'},search:{required:false},evidence:[]};
 const sent=[];
 const executors=createWebCapabilityExecutors({
   getTaskPackage:()=>pkg,setTaskPackage:v=>{pkg=v},
   getObservation:()=>({extractedText:'RFC ABCD8501011A2 CLABE 123456789012345678',observations:[]}),
   getVisionAttachment:()=>null,getConversation:()=>[],getProviders:()=>[],
   getSearchProvider:()=>({search:async plan=>{sent.push(plan.query);return {evidence:[]}}}),
   getVerifiedEntity:()=>null,setVerifiedEntity:()=>{},getPendingExecution:()=>null,setPendingExecution:()=>{},
   requestConsent:async()=>true,searchPrivacyPolicy:{requireExplicitConsent:false}
 });
 const r=await executors.SEARCH({contract:{details:{queries:['BBVA ABCD8501011A2 123456789012345678 transferencia significado']}}});
 assert.ok(['completed','failed'].includes(r.status));
 assert.equal(sent.length,1);
 assert.doesNotMatch(sent[0],/ABCD8501011A2|123456789012345678/);
 assert.match(sent[0],/BBVA|transferencia/);
});

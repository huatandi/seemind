import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherProvider} from '../core/teacher/teacher-provider.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {withVisionAttachments} from '../core/vision/vision-attachment.js';
import {prepareGroundedTask} from '../core/workflow/identity-search-verify.js';
import {validateTeacherResult} from '../core/teacher/teacher-result-validator.js';
import {sanitizeTaskPackage} from '../core/privacy/task-package-sanitizer.js';
import {searchResultsToEvidence} from '../core/search/search-evidence.js';

const observation={schemaVersion:1,modality:'image',entities:[],extractedText:'KIA',confidence:{identity:.4,overall:.7},limitations:[],observations:[]};
const image={schemaVersion:1,id:'img-1',type:'image',mimeType:'image/jpeg',width:100,height:100,byteLength:1000,dataUrl:'data:image/jpeg;base64,AA=='};
class IdentityTeacher extends TeacherProvider{
  constructor(){super('vision-id',{capabilities:['reasoning','vision'],supportedModalities:['text','image'],supportedLanguages:['auto'],privacyModes:['cloud'],supportsImages:true,reliabilityScore:.9,evidenceScore:.9});}
  async healthCheck(){return {status:'ready'}}
  async execute(){return {answer:'已确认身份',claims:[{id:'id-claim',text:'图片为 Kia Sportage',type:'fact',status:'supported',confidence:.95,evidenceRefs:['img-1']}],evidenceRefs:['img-1'],uncertainty:null,actions:[],identityProposal:{canonicalName:'Kia Sportage',category:'vehicle',brand:'Kia',model:'Sportage',confidence:.95,status:'confirmed',evidenceRefs:['img-1']}};}
}

test('identity-dependent fresh search is blocked until identity is verified',()=>{
  let p=compileTaskPackage({task:{type:'price_search',userIntent:'这个现在多少钱？',webSearchRequired:true,requiredCapabilities:['reasoning']},observation,userIntent:'这个现在多少钱？'});
  assert.equal(p.identity.ok,false);assert.equal(p.search.blocked,true);assert.equal(p.search.query,null);
});

test('verified canonical identity becomes the search query anchor before search',async()=>{
  let p=compileTaskPackage({task:{type:'price_search',userIntent:'这个现在多少钱？',webSearchRequired:true,requiredCapabilities:['reasoning']},observation,userIntent:'这个现在多少钱？'});
  p=withVisionAttachments(p,[image]); let seenQuery='';
  const searchProvider={search:async plan=>{seenQuery=plan.query;return {evidence:searchResultsToEvidence([{title:'Kia dealer',url:'https://example.test/sportage',snippet:'price'}],{requestId:'r1'}),meta:{accessedAt:new Date().toISOString()}}}};
  const r=await prepareGroundedTask({taskPackage:p,observation,providers:[new IdentityTeacher()],searchProvider,consent:true,privacyPolicy:{allowImages:true}});
  assert.equal(r.status,'ready');assert.equal(r.verifiedEntity.model,'Sportage');assert.match(seenQuery,/Kia/);assert.match(seenQuery,/Sportage/);assert.equal(r.package.identity.ok,true);assert.equal(r.package.search.status,'completed');
});

test('unverified identity never reaches search provider',async()=>{
  let p=compileTaskPackage({task:{type:'price_search',userIntent:'这个现在多少钱？',webSearchRequired:true},observation,userIntent:'这个现在多少钱？'});let called=false;
  const searchProvider={search:async()=>{called=true;return {evidence:[]}}};
  const r=await prepareGroundedTask({taskPackage:p,observation,providers:[],searchProvider,consent:false});
  assert.equal(r.status,'needs_identity_teacher');assert.equal(called,false);
});

test('identity proposal must cite supplied evidence and meet confidence threshold',()=>{
  let p=compileTaskPackage({task:{type:'price_search',userIntent:'价格'},observation,userIntent:'价格'});p=withVisionAttachments(p,[image]);
  const vp={...p,contract:{...p.contract,requireIdentityProposal:true},identityVerification:{minimumConfidence:.82}};
  const r=validateTeacherResult({answer:'maybe',claims:[],identityProposal:{canonicalName:'Kia Sportage',category:'vehicle',confidence:.95,status:'confirmed',evidenceRefs:['made-up']}},vp);
  assert.equal(r.ok,false);assert.ok(r.issues.includes('identity_unknown_evidence_ref'));
});

test('privacy sanitizer preserves safe search provenance required by freshness judge',()=>{
  const evidence=searchResultsToEvidence([{title:'Store',url:'https://example.test/x',snippet:'MXN 100'}],{requestId:'r2',accessedAt:new Date().toISOString()});
  const {package:p}=sanitizeTaskPackage({evidence},{allowImages:false});assert.equal(p.evidence[0].type,'search');assert.equal(p.evidence[0].url,'https://example.test/x');assert.ok(p.evidence[0].accessedAt);
});

test('grounded workflow attaches evidence consensus after search',async()=>{
  const task={type:'price_search',userIntent:'现在多少钱',webSearchRequired:true,requiredCapabilities:['reasoning']};
  const observation={schemaVersion:1,modality:'image',extractedText:'ACME X1',confidence:{overall:.95},limitations:[],observations:[]};
  let pkg=compileTaskPackage({task,observation,userIntent:task.userIntent,entityCandidates:[{canonicalName:'ACME X1',category:'product',brand:'ACME',model:'X1',confidence:.98,evidenceRefs:[]}]});
  pkg.identity={...pkg.identity,required:false,ok:true};
  const now=new Date().toISOString();
  const searchProvider={search:async()=>({requestId:'q',results:[
    {id:'a',title:'Store A',url:'https://shop-a.example/p',publisher:'Store A',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.9,relevance:.9,isPrimarySource:true},
    {id:'b',title:'Store B',url:'https://shop-b.example/p',publisher:'Store B',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.9,relevance:.9,isPrimarySource:true},
  ]})};
  const r=await prepareGroundedTask({taskPackage:pkg,observation,searchProvider});
  assert.equal(r.status,'ready');
  assert.equal(r.package.evidenceConsensus.recommendation,'accept_consensus');
  assert.equal(r.package.search.consensusRecommendation,'accept_consensus');
});

test('unresolved price conflict triggers targeted second search and stops on independent consensus',async()=>{
  const task={type:'price_search',userIntent:'现在多少钱',webSearchRequired:true,requiredCapabilities:['reasoning']};
  const observation={schemaVersion:1,modality:'image',extractedText:'ACME X1',confidence:{overall:.95},limitations:[],observations:[]};
  let pkg=compileTaskPackage({task,observation,userIntent:task.userIntent,entityCandidates:[{canonicalName:'ACME X1',category:'product',brand:'ACME',model:'X1',confidence:.98,evidenceRefs:[]}]});
  pkg.identity={...pkg.identity,required:false,ok:true};pkg.budget={...pkg.budget,maxSearches:3};
  const now=new Date().toISOString();let calls=0;const plans=[];
  const searchProvider={search:async plan=>{calls++;plans.push(plan);if(calls===1)return {results:[
    {id:'a',title:'Store A',url:'https://shop-a.example/p',publisher:'Store A',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.95,relevance:.95,isPrimarySource:true},
    {id:'b',title:'Store B',url:'https://shop-b.example/p',publisher:'Store B',claimKey:'price_mxn',claimValue:105,accessedAt:now,credibility:.95,relevance:.95,isPrimarySource:true},
  ],requestId:'r1'};return {results:[{id:'c',title:'Store C',url:'https://shop-c.example/p',publisher:'Store C',claimKey:'price_mxn',claimValue:100,accessedAt:now,credibility:.95,relevance:.95,isPrimarySource:true}],requestId:'r2'};}};
  const r=await prepareGroundedTask({taskPackage:pkg,observation,searchProvider});
  assert.equal(r.status,'ready');assert.equal(calls,2);assert.equal(plans[1].retrievalRound,2);assert.deepEqual(plans[1].preferredSourceTypes,['retailer']);assert.equal(r.package.evidenceConsensus.recommendation,'use_resolved_preference_with_caveat');assert.equal(r.package.evidenceRetrieval.action,'stop');assert.equal(r.package.evidenceRetrieval.caveatRequired,true);
});

test('search escalation obeys maxSearches and reports unresolved disagreement',async()=>{
  const task={type:'price_search',userIntent:'现在多少钱',webSearchRequired:true};
  const observation={schemaVersion:1,modality:'image',extractedText:'ACME X1',confidence:{overall:.95},limitations:[],observations:[]};
  let pkg=compileTaskPackage({task,observation,userIntent:task.userIntent,entityCandidates:[{canonicalName:'ACME X1',category:'product',brand:'ACME',model:'X1',confidence:.98,evidenceRefs:[]}]});pkg.identity={...pkg.identity,required:false,ok:true};pkg.budget={...pkg.budget,maxSearches:2};
  const now=new Date().toISOString();let calls=0;const searchProvider={search:async()=>{calls++;return {requestId:`r${calls}`,results:[{id:`x${calls}`,title:`Store ${calls}`,url:`https://shop-${calls}.example/p`,publisher:`Store ${calls}`,claimKey:'price_mxn',claimValue:calls===1?100:105,accessedAt:now,credibility:.95,relevance:.95,isPrimarySource:true}]}}};
  const r=await prepareGroundedTask({taskPackage:pkg,observation,searchProvider});assert.equal(calls,2);assert.equal(r.package.search.searchesUsed,2);assert.equal(r.package.evidenceRetrieval.action,'report');assert.equal(r.package.evidenceRetrieval.reason,'search_budget_exhausted');assert.ok(r.trace.includes('evidence_conflict:report_disagreement'));
});

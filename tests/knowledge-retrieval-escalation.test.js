import test from 'node:test';
import assert from 'node:assert/strict';
import {planKnowledgeRetrieval,evaluateRetrievalResults,decideEscalationAfterRetrieval} from '../core/retrieval/knowledge-retrieval-router.js';
import {KnowledgeRetrievalCoordinator} from '../core/retrieval/knowledge-retrieval-coordinator.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

function obs({confidence=.5,text='',type='object'}={}){return {detectedType:type,extractedText:text,confidence:{overall:confidence},limitations:confidence<.7?['uncertain']:[],localResolutionPossible:confidence>.75,observations:[]}}
function problem(q){return {userQuestion:q,problemSignals:[],knownFacts:[]}}
function intents(...xs){return {userText:'',intents:xs.map(intent=>({intent,confidence:.9}))}}

test('high-confidence non-fresh local question does not search',()=>{
 const p=planKnowledgeRetrieval({observation:obs({confidence:.9}),problem:problem('这是什么？'),worldDomain:{primary:'general'},intentGraph:intents('identify'),safetyRisk:{level:'R0'},localConfidence:.9,searchAvailable:true});
 assert.equal(p.localCanAnswer,true);assert.equal(p.shouldSearch,false);
});
test('low confidence identification plans web and image search',()=>{
 const p=planKnowledgeRetrieval({observation:obs({confidence:.45}),problem:problem('这是什么植物？'),worldDomain:{primary:'plant'},intentGraph:intents('identify'),safetyRisk:{level:'R0'},localConfidence:.45,searchAvailable:true});
 assert.equal(p.shouldSearch,true);assert.equal(p.needsImageSearch,true);assert.ok(p.preferredSources.includes('image_search'));
});
test('fresh find request requires current web retrieval',()=>{
 const p=planKnowledgeRetrieval({observation:obs({confidence:.9}),problem:problem('现在在哪里买最便宜？'),worldDomain:{primary:'product'},intentGraph:intents('find'),safetyRisk:{level:'R0'},localConfidence:.9,searchAvailable:true});
 assert.equal(p.needsFreshness,true);assert.equal(p.shouldSearch,true);
});
test('R2 decision requires authoritative retrieval sources',()=>{
 const p=planKnowledgeRetrieval({observation:obs({confidence:.6}),problem:problem('这个能不能吃？'),worldDomain:{primary:'food'},intentGraph:intents('safety'),safetyRisk:{level:'R2'},localConfidence:.6,searchAvailable:true});
 assert.equal(p.needsAuthority,true);assert.equal(p.requireCrossCheck,true);
});
test('two strong independent sources can satisfy retrieval',()=>{
 const plan={minimumSources:2,requireCrossCheck:true};
 const e=evaluateRetrievalResults({plan,results:[
  {title:'A',url:'https://agency.gov/a',official:true,relevance:.9,freshnessScore:.8},
  {title:'B',url:'https://university.edu/b',relevance:.88,freshnessScore:.8},
 ]});
 assert.equal(e.canAnswer,true);assert.equal(e.crossCheckOk,true);
});
test('one weak result is not treated as verified knowledge',()=>{
 const e=evaluateRetrievalResults({plan:{minimumSources:2,requireCrossCheck:true},results:[{title:'blog',url:'https://x.example/a',relevance:.3,freshnessScore:.5}]});
 assert.equal(e.canAnswer,false);
});
test('sufficient retrieval is preferred over unnecessary specialist escalation',()=>{
 const d=decideEscalationAfterRetrieval({retrievalPlan:{localCanAnswer:false,shouldSearch:true},retrievalEvaluation:{canAnswer:true},intentGraph:intents('identify'),safetyRisk:{level:'R0'},specialistAdvantage:false});
 assert.equal(d.decision,'retrieved_answer');
});
test('failed retrieval escalates onward instead of bluffing',()=>{
 const d=decideEscalationAfterRetrieval({retrievalPlan:{localCanAnswer:false,shouldSearch:true},retrievalEvaluation:{canAnswer:false},intentGraph:intents('identify'),safetyRisk:{level:'R0'}});
 assert.equal(d.decision,'specialist_or_tool');
});
test('R3 safety bypasses ordinary retrieval as final action authority',()=>{
 const d=decideEscalationAfterRetrieval({retrievalPlan:{localCanAnswer:false,shouldSearch:true},retrievalEvaluation:{canAnswer:true},intentGraph:intents('solve'),safetyRisk:{level:'R3'}});
 assert.equal(d.decision,'specialist_or_human');
});
test('coordinator executes planned searches and returns answer contract with attribution',async()=>{
 const c=new KnowledgeRetrievalCoordinator({searchFn:async({query})=>({results:[
  {title:'Official',url:'https://agency.gov/a',official:true,relevance:.95,freshnessScore:.9},
  {title:'Reference',url:'https://reference.edu/b',relevance:.9,freshnessScore:.8},
 ]})});
 const r=await c.run({plan:{shouldSearch:true,queries:['x'],minimumSources:2,requireCrossCheck:true,needsImageSearch:false},intentGraph:intents('identify'),safetyRisk:{level:'R0'},worldDomain:{primary:'general'}});
 assert.equal(r.attempted,true);assert.equal(r.evaluation.canAnswer,true);assert.equal(r.answerContract.answerPolicy.attributeSources,true);
});
test('search unavailable does not fabricate results',async()=>{
 const c=new KnowledgeRetrievalCoordinator();
 const r=await c.run({plan:{shouldSearch:true,queries:['x']},intentGraph:intents('identify'),safetyRisk:{level:'R0'}});
 assert.equal(r.attempted,false);assert.equal(r.errorCode,'SEARCH_UNAVAILABLE');assert.equal(r.evaluation.results.length,0);
});
test('universal explainer exposes retrieval and escalation plans',()=>{
 const e=buildUniversalExplanation({observation:obs({confidence:.4}),textInput:'这是什么植物？'});
 assert.ok(e.retrievalPlan);assert.ok(e.escalationPlan);assert.equal(typeof e.retrievalPlan.shouldSearch,'boolean');
});

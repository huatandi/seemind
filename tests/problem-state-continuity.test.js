import test from 'node:test';
import assert from 'node:assert/strict';
import {createProblemState,updateProblemState} from '../core/resolution/problem-state.js';
import {createEvidenceGraph,addPhotoEvidence} from '../core/evidence/evidence-graph.js';
import {runBrainMainline} from '../core/brain/brain-mainline.js';

function observation(id,label='router'){
 return {id,inputId:id,detectedType:'object',extractedText:'',confidence:{overall:.8},limitations:[],observations:[
  {kind:'general_vision',identity:[{label,confidence:.9,status:'observed'}],states:[],anomalies:[],regions:[]}
 ]};
}

test('same observation is not counted as a new photo on every user follow-up',()=>{
 let g=createEvidenceGraph();
 const first=addPhotoEvidence(g,{observation:observation('obs-1'),userText:'这个是什么'});g=first.graph;
 const second=addPhotoEvidence(g,{observation:observation('obs-1'),userText:'它为什么闪'});
 assert.equal(second.graph.photos.length,1);
 assert.equal(second.match.status,'same_observation');
});

test('likely new object resets object-specific Problem State instead of contaminating target',()=>{
 const old=createProblemState({
  target:{id:'old',label:'router'},goal:'troubleshoot',
  symptoms:[{type:'blinking',text:'红灯闪'}],
  attemptedActions:[{type:'power_cycle',sourceText:'已经重启'}],
  facts:[{id:'f1',value:'old-fact'}],
 });
 const session={
  lastPhotoRelationship:{status:'likely_new_object',entityId:'entity:new',confidence:.97},
  activeEntitySummary:{entity:{id:'entity:new',labels:['coffee machine']}},
  subject:{label:'coffee machine'},
  goal:'identify_and_explain',
  symptoms:[],evidence:[{kind:'visual_identity',text:'coffee machine'}],attempts:[],
 };
 const next=updateProblemState(old,{problemSession:session});
 assert.equal(next.target.id,'entity:new');
 assert.equal(next.target.label,'coffee machine');
 assert.equal(next.symptoms.length,0);
 assert.equal(next.attemptedActions.length,0);
 assert.equal(next.facts.some(x=>x.value==='old-fact'),false);
 assert.equal(next.continuity.status,'new_object');
});

test('unresolved photo relationship quarantines new object evidence instead of merging it',()=>{
 const old=createProblemState({target:{id:'old',label:'router'},facts:[{id:'old-fact',value:'router'}]});
 const problem={userQuestion:'你看看这个',knownFacts:[{id:'new-fact',value:'motor'}],unknownFacts:[],multimodalUnknowns:[],symptoms:[],attemptedActions:[],intentHypotheses:[{intent:'identify_and_explain'}],referencedObjects:[]};
 const session={lastPhotoRelationship:{status:'unresolved',confidence:.5},evidence:[{id:'new-evidence',value:'motor'}],attempts:[],symptoms:[]};
 const next=updateProblemState(old,{problem,problemSession:session});
 assert.equal(next.target.label,'router');
 assert.equal(next.facts.some(x=>x.id==='new-fact'||x.id==='new-evidence'),false);
 assert.equal(next.quarantined.length,1);
 assert.equal(next.continuity.status,'unresolved');
});

test('new user task ignores stale previous package Search completion in Brain Mainline',()=>{
 const oldPackage={
  task:{id:'old-task'},
  search:{status:'completed'},
  evidenceConsensus:{status:'consistent',recommendation:'use_consensus'},
 };
 const task={id:'new-task',type:'question',userIntent:'新问题'};
 const explanation={
  problem:{intentHypotheses:[{intent:'identify_and_explain'}],knownFacts:[],unknownFacts:[],referencedObjects:[]},
  retrievalPlan:{shouldSearch:false},safety:{risk:{level:'LOW'}}
 };
 const observation={confidence:{overall:.8},limitations:[],observations:[]};
 const out=runBrainMainline({task,observation,explanation,capabilities:{searchAvailable:false,teacherCount:0},taskPackage:oldPackage});
 assert.equal(out.context.retrieval.packageSearch,null);
 assert.equal(out.context.evidence.consensus,null);
});

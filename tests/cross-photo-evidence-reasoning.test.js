import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceGraph,addPhotoEvidence,buildEntityEvidenceSummary,resolvePhotoEntity} from '../core/evidence/evidence-graph.js';
import {createProblemSolvingSession,updateProblemSolvingSession,summarizeProblemState} from '../core/resolution/problem-solving-session.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

function obs({text='',label='device',confidence=.92,state=null}={}){
 return {
  detectedType:'object',extractedText:text,confidence:{overall:.85},limitations:[],localResolutionPossible:false,
  observations:[
   {kind:'general_vision',providerId:'v',identity:[{label,confidence,status:confidence>=.85?'observed':'candidate'}],scene:[],states:state?[{label:state,confidence:.85,status:'observed'}]:[],anomalies:[],regions:[{id:'r1',regionType:'object',objectType:label,confidence,bbox:{x:.1,y:.1,width:.6,height:.6},tags:[]}],relationships:[],limitations:[]},
   {kind:'structured_facts',facts:[]},
   {kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}},
  ]
 };
}

test('first photo creates one real-world entity',()=>{
 const r=addPhotoEvidence(createEvidenceGraph(),{observation:obs(),userText:'这是这台机器'});
 assert.equal(r.graph.entities.length,1);
 assert.equal(r.graph.photos.length,1);
 assert.equal(r.photo.entityId,r.graph.entities[0].id);
});

test('nameplate photo with matching model attaches to same entity',()=>{
 let g=createEvidenceGraph();
 g=addPhotoEvidence(g,{observation:obs({text:'BRAND ACME MODEL MX-100'}),userText:'这台机器'}).graph;
 const second=addPhotoEvidence(g,{observation:obs({text:'MODEL: MX-100 SERIAL: SN001'}),userText:'这是背面的铭牌'});
 assert.equal(second.match.status,'same_object');
 assert.equal(second.graph.entities.length,1);
 assert.equal(second.graph.photos.length,2);
});

test('conflicting model creates likely new object instead of forced merge',()=>{
 let g=createEvidenceGraph();
 g=addPhotoEvidence(g,{observation:obs({text:'MODEL: MX-100'})}).graph;
 const r=addPhotoEvidence(g,{observation:obs({text:'MODEL: ZX-900'})});
 assert.equal(r.match.status,'likely_new_object');
 assert.equal(r.graph.entities.length,2);
});

test('explicit user language can mark another device as new object',()=>{
 let g=createEvidenceGraph();
 g=addPhotoEvidence(g,{observation:obs({text:'MODEL: MX-100'})}).graph;
 const photo={...addPhotoEvidence(createEvidenceGraph(),{observation:obs({text:'MODEL: MX-100'})}).photo};
 const r=resolvePhotoEntity(g,photo,{userText:'这是另外一台机器'});
 assert.equal(r.status,'likely_new_object');
 assert.equal(r.entityId,null);
});

test('entity summary combines model error code state and views',()=>{
 let g=createEvidenceGraph();
 g=addPhotoEvidence(g,{observation:obs({text:'MODEL: MX-100'}),userText:'整机'}).graph;
 g=addPhotoEvidence(g,{observation:obs({text:'ERROR E12',state:'red_indicator'}),userText:'这是这台设备的控制面板'}).graph;
 const s=buildEntityEvidenceSummary(g);
 assert.equal(s.model,'MX-100');
 assert.ok(s.errorCodes.includes('E12'));
 assert.ok(s.states.includes('red_indicator'));
 assert.equal(s.photoCount,2);
});

test('problem solving session persists cross-photo graph across updates',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{observation:obs({text:'MODEL: MX-100'}),userText:'这是这台设备'});
 s=updateProblemSolvingSession(s,{observation:obs({text:'ERROR E12'}),userText:'这是它的屏幕'});
 assert.equal(s.evidenceGraph.photos.length,2);
 assert.equal(s.evidenceGraph.entities.length,1);
 assert.equal(s.activeEntitySummary.model,'MX-100');
 assert.ok(s.activeEntitySummary.errorCodes.includes('E12'));
});

test('unresolved cross-photo relationship does not attach evidence to existing entity',()=>{
 let g=createEvidenceGraph();
 g=addPhotoEvidence(g,{observation:obs({text:'MODEL: MX-100'})}).graph;
 const weak={...addPhotoEvidence(createEvidenceGraph(),{observation:obs({label:'unknown-object',confidence:.55})}).photo,userText:''};
 const r=resolvePhotoEntity(g,weak,{userText:''});
 assert.ok(['unresolved','likely_new_object'].includes(r.status));
 if(r.status==='unresolved')assert.equal(r.entityId,null);
});

test('universal explanation surfaces same-object relationship after second photo',()=>{
 let first=buildUniversalExplanation({observation:obs({text:'MODEL: MX-100'}),textInput:'这台设备'});
 const second=buildUniversalExplanation({observation:obs({text:'ERROR E12'}),textInput:'这是它的屏幕',problemState:first.problemState});
 assert.ok(second.problemState.activeEntitySummary.photoCount>=2);
 assert.ok(second.highlights.some(x=>x.label==='多图关系'));
});

test('universal explanation tells user when photo likely belongs to another object',()=>{
 const first=buildUniversalExplanation({observation:obs({text:'MODEL: MX-100'}),textInput:'这台设备'});
 const second=buildUniversalExplanation({observation:obs({text:'MODEL: ZX-900'}),textInput:'另外一台机器',problemState:first.problemState});
 assert.equal(second.problemState.lastPhotoRelationship.status,'likely_new_object');
 assert.ok(second.highlights.some(x=>/另一个对象/.test(x.text)));
});

test('compact problem state contains active entity summary but not raw full graph',()=>{
 let s=createProblemSolvingSession();
 s=updateProblemSolvingSession(s,{observation:obs({text:'MODEL: MX-100'})});
 const summary=summarizeProblemState(s);
 assert.ok(summary.activeEntity);
 assert.equal('evidenceGraph' in summary,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createObjectContinuityState,updateObjectContinuity,resolveConversationReference} from '../core/multimodal/object-continuity.js';
import {createMultimodalSession,addVisualObservation,addMultimodalTurn,resolveSessionReference} from '../core/multimodal/multimodal-session.js';
import {runSequentialMultimodalCases} from '../core/perception/lab/multimodal-case-runner.js';

const visual={detectedType:'device',confidence:{overall:.9},limitations:[],observations:[
 {kind:'image_preprocessing',width:100,height:100},
 {kind:'general_vision',providerId:'test',identity:[{label:'control panel',confidence:.9,status:'observed'}]},
 {kind:'visual_regions',regions:[{id:'r1',bbox:{x:70,y:20,width:15,height:15},objectType:'indicator',confidence:.98,tags:['indicator','color:red']}]},
]};

const grounded={references:[{type:'red_indicator',sourceText:'红灯',groundingStatus:'resolved',groundedRegionId:'r1',groundingConfidence:.98}],visual:{facts:[{id:'f1',category:'identity',value:'control panel',confidence:.9}]}};

test('object continuity carries focused real-world entity into pronoun follow-up',()=>{
 let s=createObjectContinuityState();s=updateObjectContinuity(s,{context:grounded,visualObservation:visual});
 const r=resolveConversationReference({text:'那它为什么一直响？',state:s,currentContext:{references:[]}});
 assert.equal(r.resolved,true);assert.equal(r.entityId,'entity:r1');
});

test('current visual grounding has priority over stale conversation pronoun',()=>{
 let s=createObjectContinuityState();s=updateObjectContinuity(s,{context:grounded,visualObservation:visual});
 const r=resolveConversationReference({text:'这个是什么？',state:s,currentContext:{references:[{groundedRegionId:'r2'}]}});
 assert.equal(r.resolved,false);assert.equal(r.reason,'CURRENT_VISUAL_REFERENCE_HAS_PRIORITY');
});

test('multimodal session stores continuity resolution on follow-up turn',()=>{
 const s=createMultimodalSession();addVisualObservation(s,visual);addMultimodalTurn(s,{speechText:'这个红灯是什么？',context:grounded,visualObservation:visual});
 const r=resolveSessionReference(s,'那它为什么一直响？');
 assert.equal(r.resolved,true);
 addMultimodalTurn(s,{speechText:'那它为什么一直响？',context:{references:[]},visualObservation:visual});
 assert.equal(s.turns.at(-1).continuityResolution.resolved,true);
});

test('sequential benchmark measures cross-turn continuity rather than isolated prompts',async()=>{
 const cases=[
  {id:'a',modality:'multimodal',assetRef:'x',language:'zh-CN',input:{speechText:'这个红灯是什么？'},expected:{intent:'identify',target:'r1'}},
  {id:'b',modality:'multimodal',assetRef:'x',language:'zh-CN',input:{speechText:'那它为什么一直响？'},expected:{intent:'diagnose',conversationEntity:'entity:r1'}},
 ];
 const out=await runSequentialMultimodalCases({cases,resolveAsset:async()=>new Blob(['x']),observeImage:async()=>visual});
 assert.equal(out.results.length,2);assert.equal(out.results[1].conversationReference.resolved,true);assert.equal(out.continuitySuccessRate,1);
});

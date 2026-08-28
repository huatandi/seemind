import test from 'node:test';
import assert from 'node:assert/strict';
import {PilotCorpusBuilder} from '../core/perception/lab/pilot-corpus-builder.js';
import {auditRealWorldCorpus} from '../core/perception/lab/real-world-corpus-policy.js';
import {runMultimodalCase,runMultimodalCorpus} from '../core/perception/lab/multimodal-case-runner.js';

test('pilot multimodal case preserves what the user actually said',()=>{
 const b=new PilotCorpusBuilder();
 const c=b.addMultimodal({assetRef:'vault:x',speechText:'右边这个红灯为什么一直闪？',language:'zh-CN',expected:{intent:'diagnose',reference:'右边',stateOrProblem:'blinking_indicator'}});
 assert.equal(c.input.speechText,'右边这个红灯为什么一直闪？');
});

test('real-world corpus audit catches missing reference/problem coverage',()=>{
 const a=auditRealWorldCorpus([{modality:'multimodal',language:'zh-CN',conditions:{scenario:'identify_with_reference'}}]);
 assert.equal(a.ready,false);assert.ok(a.issues.some(x=>x.code==='PROBLEM_STATE_CASES_TOO_FEW'));
});

test('multimodal case truly fuses visual regions and speech reference',async()=>{
 const visual={
  detectedType:'device',confidence:{overall:.9},limitations:[],
  observations:[
   {kind:'image_preprocessing',width:100,height:100},
   {kind:'general_vision',providerId:'test',identity:[{label:'control panel',confidence:.9,status:'observed'}],states:[{label:'blinking',confidence:.8,status:'candidate'}]},
   {kind:'visual_regions',regions:[{id:'r1',bbox:{x:70,y:20,width:15,height:15,normalized:{x:.70,y:.20,width:.15,height:.15}},objectType:'indicator',confidence:.98,tags:['indicator','color:red']}]},
  ]
 };
 const c={id:'mm1',modality:'multimodal',assetRef:'vault:x',language:'zh-CN',input:{speechText:'右边这个红灯为什么一直闪？'},expected:{intent:'diagnose',reference:'右边',target:'r1',stateOrProblem:'blinking_indicator'}};
 const r=await runMultimodalCase({case:c,resolveAsset:async()=>new Blob(['x']),observeImage:async()=>visual});
 assert.equal(r.context.references.some(x=>x.groundingStatus==='resolved'&&x.groundedRegionId==='r1'),true);
 assert.equal(r.actual.target,'r1');assert.equal(r.actual.stateOrProblem,'blinking_indicator');
 assert.ok(r.score.score>=.75);
});

test('multimodal corpus reports success, quality and latency without invented scores',async()=>{
 const visual={detectedType:'object',confidence:{overall:.8},observations:[{kind:'general_vision',providerId:'t',identity:[{label:'cup',confidence:.9,status:'observed'}]}],limitations:[]};
 const cases=[{id:'m',modality:'multimodal',assetRef:'vault:x',language:'en',input:{speechText:'what is this'},expected:{intent:'identify',target:'cup'}}];
 const r=await runMultimodalCorpus({cases,resolveAsset:async()=>new Blob(['x']),observeImage:async()=>visual});
 assert.equal(r.summary.cases,1);assert.equal(r.summary.successRate,1);assert.ok(r.summary.avgGroundingScore>=0);
});

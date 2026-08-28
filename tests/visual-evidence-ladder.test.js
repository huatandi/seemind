import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyVisualIdentityClaim,strongestVisualIdentityEvidence} from '../core/vision/visual-evidence-ladder.js';
import {routeVisualCapabilities} from '../core/vision/visual-capability-router.js';
import {TransformersDetrProvider} from '../providers/local/vision/transformers-detr-provider.js';

test('generic detector label is category evidence even at high confidence',()=>{
  assert.equal(classifyVisualIdentityClaim({label:'car',confidence:.95,evidence:{provider:'DETR'}}).level,'category');
});

test('explicit brand evidence reaches brand level',()=>{
  assert.equal(classifyVisualIdentityClaim({label:'Kia',confidence:.9,evidence:{brand:'Kia'}}).level,'brand');
});

test('strongest visual evidence respects semantic specificity before confidence',()=>{
  const observation={observations:[{kind:'general_vision',providerId:'a',identity:[
    {label:'car',confidence:.99,evidenceLevel:'category'},
    {label:'Kia',confidence:.81,evidenceLevel:'brand'},
  ]}]};
  assert.equal(strongestVisualIdentityEvidence(observation).level,'brand');
});

test('high-confidence category satisfies basic object identity but not explicit brand/model identity',()=>{
  const observation={detectedType:'unknown',observations:[{kind:'general_vision',providerId:'detr',
    identity:[{label:'car',confidence:.99,status:'observed',evidenceLevel:'category'}],
    regions:[{id:'r1',regionType:'object',objectType:'car',confidence:.99,bbox:{x:0,y:0,width:1,height:1}}]
  }]};
  const basic=routeVisualCapabilities({observation,userQuestion:'这是什么？'});
  assert.ok(basic.localCapabilities.includes('object_identity'));
  const specific=routeVisualCapabilities({observation,userQuestion:'这是什么品牌和具体型号？'});
  assert.equal(specific.localCapabilities.includes('specific_identity'),false);
  assert.ok(specific.missingCapabilities.includes('specific_identity'));
});

test('brand-level evidence can satisfy explicit specific identity capability',()=>{
  const observation={detectedType:'object',observations:[{kind:'general_vision',providerId:'brand-model',
    identity:[{label:'Kia',confidence:.9,status:'observed',evidenceLevel:'brand',evidence:{brand:'Kia'}}],regions:[]
  }]};
  const route=routeVisualCapabilities({observation,userQuestion:'这是什么品牌？'});
  assert.ok(route.localCapabilities.includes('specific_identity'));
});

test('DETR advertises basic object identity while its evidence remains category-level',()=>{
  const p=new TransformersDetrProvider({pipelineLoader:async()=>({pipeline:async()=>async()=>[]})});
  const caps=p.getProfile().capabilities.map(x=>x.capability);
  assert.ok(caps.includes('object_identity'));
  assert.equal(caps.includes('specific_identity'),false);
});

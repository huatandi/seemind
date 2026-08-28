import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisualRegionEvidence} from '../core/grounding/region-evidence.js';
import {groundLanguageReferences} from '../core/grounding/visual-language-grounding.js';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';

function obs({width=1000,height=800,blocks=[],regions=[]}={}){
 return {
  detectedType:'device',confidence:{overall:.8},limitations:[],
  observations:[
    {kind:'image_preprocessing',width,height},
    {kind:'ocr',blocks,rawText:blocks.map(x=>x.text).join('\n')},
    {kind:'structured_facts',facts:[]},
    ...(regions.length?[{kind:'visual_regions',regions}]:[]),
  ]
 };
}

test('OCR bounding boxes become normalized visual region evidence',()=>{
 const v=buildVisualRegionEvidence(obs({blocks:[{id:'b1',text:'E21',confidence:.9,bbox:{x:700,y:80,width:120,height:50}}]}));
 const r=v.regions[0];
 assert.equal(r.source,'ocr');
 assert.equal(r.bbox.normalized.x,.7);
 assert.equal(r.bbox.normalized.y,.1);
 assert.ok(r.tags.includes('error_code'));
});

test('displayed-code reference can ground to a unique OCR code region',()=>{
 const o=obs({blocks:[
  {id:'b1',text:'SAMSUNG',confidence:.95,bbox:{x:100,y:100,width:200,height:50}},
  {id:'b2',text:'E21',confidence:.95,bbox:{x:700,y:100,width:100,height:50}},
 ]});
 const g=groundLanguageReferences({observation:o,references:[{type:'displayed_code',sourceText:'这个代码',confidence:.9}]});
 assert.equal(g.results[0].status,'resolved');
 assert.equal(g.results[0].regionId,'b2');
});

test('right-side reference may ground when exactly one strong region is on the right',()=>{
 const o=obs({blocks:[{id:'b1',text:'E21',confidence:.95,bbox:{x:760,y:100,width:80,height:40}}]});
 const g=groundLanguageReferences({observation:o,references:[{type:'right_side',sourceText:'右边',confidence:.9}]});
 assert.equal(g.results[0].status,'tentative');
 assert.equal(g.results[0].regionId,'b1');
});

test('generic here reference remains unresolved without pointing coordinates',()=>{
 const o=obs({blocks:[{id:'b1',text:'E21',confidence:.95,bbox:{x:760,y:100,width:80,height:40}}]});
 const g=groundLanguageReferences({observation:o,references:[{type:'this_region',sourceText:'这里',confidence:.9}]});
 assert.equal(g.results[0].status,'unresolved');
 assert.equal(g.results[0].regionId,null);
});

test('red-indicator reference does not ground from OCR text alone',()=>{
 const o=obs({blocks:[{id:'b1',text:'ERROR',confidence:.95,bbox:{x:700,y:100,width:100,height:40}}]});
 const g=groundLanguageReferences({observation:o,references:[{type:'red_indicator',sourceText:'红灯',confidence:.9}]});
 assert.equal(g.results[0].status,'unresolved');
});

test('semantic visual region can resolve red indicator',()=>{
 const o=obs({regions:[
  {id:'led1',source:'object-detector',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.72,y:.18,width:.05,height:.05},tags:['indicator','color:red']}
 ]});
 const g=groundLanguageReferences({observation:o,references:[{type:'red_indicator',sourceText:'红灯',confidence:.9}]});
 assert.equal(g.results[0].status,'resolved');
 assert.equal(g.results[0].regionId,'led1');
});

test('right + red indicator compound evidence resolves the same region',()=>{
 const o=obs({regions:[
  {id:'led-left',source:'vision',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.2,y:.2,width:.05,height:.05},tags:['indicator','color:red']},
  {id:'led-right',source:'vision',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.75,y:.2,width:.05,height:.05},tags:['indicator','color:red']},
 ]});
 const refs=[
  {type:'right_side',sourceText:'右边',confidence:.9},
  {type:'red_indicator',sourceText:'红灯',confidence:.9},
 ];
 const g=groundLanguageReferences({observation:o,references:refs});
 const c=g.compounds.find(x=>x.referenceTypes.includes('right_side')&&x.referenceTypes.includes('red_indicator'));
 assert.equal(c.status,'resolved');
 assert.equal(c.regionId,'led-right');
});

test('two equally plausible right-side regions remain unresolved',()=>{
 const o=obs({regions:[
  {id:'a',source:'vision',regionType:'object',confidence:.9,bbox:{x:.7,y:.2,width:.05,height:.05},tags:[]},
  {id:'b',source:'vision',regionType:'object',confidence:.9,bbox:{x:.8,y:.6,width:.05,height:.05},tags:[]},
 ]});
 const g=groundLanguageReferences({observation:o,references:[{type:'right_side',sourceText:'右边',confidence:.9}]});
 assert.equal(g.results[0].status,'unresolved');
});

test('multimodal context carries grounding results and removes resolved reference unknown',()=>{
 const o=obs({regions:[
  {id:'led1',source:'vision',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.75,y:.2,width:.05,height:.05},tags:['indicator','color:red']}
 ]});
 const m=fuseMultimodalContext({visualObservation:o,speechText:'右边红灯为什么一直闪？'});
 assert.ok(m.grounding);
 const red=m.references.find(x=>x.type==='red_indicator');
 assert.equal(red.groundingStatus,'resolved');
 assert.equal(red.groundedRegionId,'led1');
 assert.equal(m.unknowns.some(x=>x.id==='reference.red_indicator'),false);
});

test('multimodal context keeps unresolved "这里" as an explicit unknown',()=>{
 const o=obs({regions:[
  {id:'part1',source:'vision',regionType:'object',confidence:.95,bbox:{x:.3,y:.3,width:.2,height:.2},tags:['part']}
 ]});
 const m=fuseMultimodalContext({visualObservation:o,speechText:'这里是不是坏了？'});
 assert.equal(m.references.find(x=>x.type==='this_region').groundingStatus,'unresolved');
 assert.ok(m.unknowns.some(x=>x.id==='reference.this_region'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {groundLanguageReferences} from '../core/grounding/visual-language-grounding.js';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';

function reg(id,type,x,y,w,h,tags=[],parentId=null){
  return {id,regionType:'object',objectType:type,confidence:.96,bbox:{x,y,width:w,height:h},tags,parentId};
}
function visual(regions){return {detectedType:'device',confidence:{overall:.9},observations:[
  {kind:'general_vision',providerId:'test',identity:[],scene:[],states:[],regions},
]};}

test('right + red indicator requires the same region to satisfy both constraints',()=>{
  const o=visual([
    reg('left-red','indicator',.12,.4,.08,.08,['indicator','color:red']),
    reg('right-green','indicator',.78,.4,.08,.08,['indicator','color:green']),
  ]);
  const refs=[{type:'right_side',sourceText:'右边'},{type:'red_indicator',sourceText:'红灯'}];
  const g=groundLanguageReferences({observation:o,references:refs});
  const c=g.compounds.find(x=>x.referenceTypes.includes('right_side')&&x.referenceTypes.includes('red_indicator'));
  assert.notEqual(c?.status,'resolved');
});

test('right + red indicator resolves when one region satisfies both',()=>{
  const o=visual([
    reg('left-green','indicator',.12,.4,.08,.08,['indicator','color:green']),
    reg('right-red','indicator',.78,.4,.08,.08,['indicator','color:red']),
  ]);
  const refs=[{type:'right_side',sourceText:'右边'},{type:'red_indicator',sourceText:'红灯'}];
  const g=groundLanguageReferences({observation:o,references:refs});
  const c=g.compounds.find(x=>x.referenceTypes.includes('right_side')&&x.referenceTypes.includes('red_indicator'));
  assert.equal(c.status,'resolved');
  assert.equal(c.regionId,'right-red');
});

test('ordinal is resolved within a uniquely selected spatial parent, not globally',()=>{
  const o=visual([
    reg('left-box','device',.05,.15,.4,.65,['container']),
    reg('right-box','device',.55,.15,.4,.65,['container']),
    reg('l1','indicator',.10,.35,.08,.08,['indicator'],'left-box'),
    reg('l2','indicator',.25,.35,.08,.08,['indicator'],'left-box'),
    reg('r1','indicator',.60,.35,.08,.08,['indicator'],'right-box'),
    reg('r2','indicator',.75,.35,.08,.08,['indicator'],'right-box'),
  ]);
  const refs=[{type:'left_side',sourceText:'左边'},{type:'ordinal_2',sourceText:'第二个'}];
  const g=groundLanguageReferences({observation:o,references:refs});
  const c=g.compounds.find(x=>x.reason==='PARENT_SCOPED_ORDINAL_EVIDENCE');
  assert.equal(c.status,'resolved');
  assert.equal(c.parentRegionId,'left-box');
  assert.equal(c.regionId,'l2');
});

test('multimodal fusion preserves parent and child identities for hierarchical phrase',()=>{
  const o=visual([
    reg('left-box','device',.05,.15,.4,.65,['container']),
    reg('right-box','device',.55,.15,.4,.65,['container']),
    reg('l1','indicator',.10,.35,.08,.08,['indicator'],'left-box'),
    reg('l2','indicator',.25,.35,.08,.08,['indicator'],'left-box'),
    reg('r1','indicator',.60,.35,.08,.08,['indicator'],'right-box'),
    reg('r2','indicator',.75,.35,.08,.08,['indicator'],'right-box'),
  ]);
  const ctx=fuseMultimodalContext({visualObservation:o,speechText:'左边第二个为什么一直闪？'});
  const left=ctx.references.find(x=>x.type==='left_side');
  const second=ctx.references.find(x=>x.type==='ordinal_2');
  assert.equal(left.groundedRegionId,'left-box');
  assert.equal(second.groundedRegionId,'l2');
  assert.equal(second.parentRegionId,'left-box');
});

test('ambiguous parent selection leaves hierarchical ordinal unresolved',()=>{
  const o=visual([
    reg('left-a','device',.05,.10,.38,.35,['container']),
    reg('left-b','device',.05,.55,.38,.35,['container']),
    reg('a1','indicator',.10,.18,.08,.08,['indicator'],'left-a'),
    reg('a2','indicator',.25,.18,.08,.08,['indicator'],'left-a'),
    reg('b1','indicator',.10,.63,.08,.08,['indicator'],'left-b'),
    reg('b2','indicator',.25,.63,.08,.08,['indicator'],'left-b'),
  ]);
  const refs=[{type:'left_side',sourceText:'左边'},{type:'ordinal_2',sourceText:'第二个'}];
  const g=groundLanguageReferences({observation:o,references:refs});
  assert.equal(g.compounds.some(x=>x.reason==='PARENT_SCOPED_ORDINAL_EVIDENCE'),false);
});

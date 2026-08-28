import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSpeechEvidence} from '../core/multimodal/speech-evidence.js';
import {groundLanguageReferences} from '../core/grounding/visual-language-grounding.js';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';

function visual(regions){
  return {detectedType:'device',confidence:{overall:.9},observations:[
    {kind:'general_vision',providerId:'test',identity:[],scene:[],states:[],regions},
  ]};
}
function region(id,x,y=.4){return {id,regionType:'object',objectType:'indicator',confidence:.95,bbox:{x,y,width:.12,height:.12}}}

test('speech evidence extracts Chinese ordinal reference',()=>{
  const e=extractSpeechEvidence('第二个为什么一直闪红？');
  assert.ok(e.references.some(x=>x.type==='ordinal_2'));
  assert.ok(e.symptoms.some(x=>x.type==='blinking_indicator'));
  assert.ok(e.temporal.some(x=>x.type==='persistent'));
});

test('second object grounds to second visual region in a clear horizontal row',()=>{
  const o=visual([region('a',.1),region('b',.42),region('c',.74)]);
  const g=groundLanguageReferences({observation:o,references:[{type:'ordinal_2',sourceText:'第二个'}]});
  assert.equal(g.results[0].status,'resolved');
  assert.equal(g.results[0].regionId,'b');
});

test('ordinal grounding does not trust detector array order',()=>{
  const o=visual([region('c',.74),region('a',.1),region('b',.42)]);
  const g=groundLanguageReferences({observation:o,references:[{type:'ordinal_2',sourceText:'第二个'}]});
  assert.equal(g.results[0].regionId,'b');
});

test('ambiguous 2-D layout leaves ordinal unresolved instead of guessing',()=>{
  const o=visual([region('a',.1,.1),region('b',.45,.45),region('c',.72,.72)]);
  const g=groundLanguageReferences({observation:o,references:[{type:'ordinal_2',sourceText:'第二个'}]});
  assert.equal(g.results[0].status,'unresolved');
  assert.equal(g.results[0].regionId,null);
});

test('multimodal fusion binds ordinal speech to a region and preserves symptom/time evidence',()=>{
  const o=visual([region('power',.08),region('internet',.42),region('wifi',.76)]);
  const ctx=fuseMultimodalContext({visualObservation:o,speechText:'第二个为什么一直闪？'});
  const ref=ctx.references.find(x=>x.type==='ordinal_2');
  assert.equal(ref.groundingStatus,'resolved');
  assert.equal(ref.groundedRegionId,'internet');
  assert.ok(ctx.symptoms.some(x=>x.type==='blinking_indicator'));
  assert.ok(ctx.temporalContext.some(x=>x.type==='persistent'));
  assert.equal(ctx.unknowns.some(x=>x.id==='reference.ordinal_2'),false);
});

test('English and Spanish ordinal phrases are recognized',()=>{
  assert.ok(extractSpeechEvidence('why is the second one blinking').references.some(x=>x.type==='ordinal_2'));
  assert.ok(extractSpeechEvidence('por qué parpadea el segundo').references.some(x=>x.type==='ordinal_2'));
});

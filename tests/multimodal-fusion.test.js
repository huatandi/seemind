import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSpeechEvidence} from '../core/multimodal/speech-evidence.js';
import {fuseMultimodalContext,buildMultimodalProblemPrompt} from '../core/multimodal/multimodal-fusion.js';
import {understandProblem} from '../core/resolution/problem-understanding.js';

function visual({type='appliance',facts=[],overall=.75,limitations=[]}={}){
  return {
    detectedType:type,confidence:{overall},limitations,
    observations:[{kind:'structured_facts',facts}]
  };
}

test('speech evidence extracts symptoms, timing, attempted actions and intent',()=>{
  const s=extractSpeechEvidence('这个昨天还好好的，今天红灯一直闪，我拔过一次插头还是不工作，怎么办？');
  assert.ok(s.symptoms.some(x=>x.type==='blinking_indicator'));
  assert.ok(s.symptoms.some(x=>x.type==='not_working'));
  assert.ok(s.temporal.some(x=>x.type==='yesterday_context'));
  assert.ok(s.temporal.some(x=>x.type==='today_context'));
  assert.ok(s.attemptedActions.some(x=>x.type==='power_cycle'));
  assert.ok(s.intentSignals.some(x=>x.type==='solve_or_guide'));
});

test('multimodal fusion keeps visual and user-reported evidence separate',()=>{
  const v=visual({facts:[{id:'identity.brand',category:'identity',name:'brand',value:'SAMSUNG',confidence:.95,status:'resolved',conflicts:[]}]});
  const m=fuseMultimodalContext({visualObservation:v,speechText:'这个红灯一直闪，我昨天已经重新插过电源'});
  assert.equal(m.visual.facts[0].value,'SAMSUNG');
  assert.ok(m.speech.symptoms.some(x=>x.type==='blinking_indicator'));
  assert.ok(m.attemptedActions.some(x=>x.type==='power_cycle'));
  assert.equal(m.evidencePolicy.speechCannotCreateVisualFact,true);
  assert.equal(m.evidencePolicy.visualCannotCreateUserHistory,true);
});

test('spatial reference remains unresolved until visual grounding exists',()=>{
  const m=fuseMultimodalContext({visualObservation:visual(),speechText:'右边这个红灯为什么一直闪？'});
  const right=m.references.find(x=>x.type==='right_side');
  const red=m.references.find(x=>x.type==='red_indicator');
  assert.equal(right.status,'unresolved');
  assert.equal(right.requiresVisualGrounding,true);
  assert.equal(red.requiresVisualGrounding,true);
  assert.ok(m.unknowns.some(x=>x.id==='reference.right_side'));
});

test('speech uncertainty remains explicit instead of being promoted to fact',()=>{
  const m=fuseMultimodalContext({visualObservation:visual(),speechText:'型号好像是 B 什么 320，我记不清'});
  assert.ok(m.speech.uncertainSegments.length>=1);
  assert.ok(m.unknowns.some(x=>x.id==='speech.uncertain_segment'));
});

test('known identity can tentatively ground this-object reference',()=>{
  const m=fuseMultimodalContext({
    visualObservation:visual({facts:[{id:'identity.merchant',category:'identity',name:'merchant',value:'ABC',confidence:.9,status:'resolved',conflicts:[]}]}),
    speechText:'这个是什么？'
  });
  const ref=m.references.find(x=>x.type==='this_object');
  assert.equal(ref.status,'tentative');
  assert.deepEqual(ref.candidateFactIds,['identity.merchant']);
});

test('prompt contract explicitly separates modalities and unknowns',()=>{
  const m=fuseMultimodalContext({visualObservation:visual(),speechText:'这里漏油了，怎么办？'});
  const p=buildMultimodalProblemPrompt(m);
  assert.equal(p.task,'understand_and_help_with_real_world_problem');
  assert.match(p.instruction,/Never invent visual evidence or user history/);
  assert.ok(p.symptoms.some(x=>x.type==='leak'));
  assert.ok(p.references.some(x=>x.type==='this_region'));
});

test('problem understanding receives multimodal symptoms and attempted actions',()=>{
  const v=visual({limitations:['cause unknown']});
  const m=fuseMultimodalContext({visualObservation:v,speechText:'这个一直响，我已经拔过一次插头，怎么处理？'});
  const p=understandProblem(v,{userQuestion:m.speech.rawText,multimodalContext:m});
  assert.ok(p.symptoms.some(x=>x.type==='abnormal_sound'));
  assert.ok(p.attemptedActions.some(x=>x.type==='power_cycle'));
  assert.equal(p.referencedObjects.some(x=>x.type==='this_object'),true);
});

test('conversation context is preserved but bounded',()=>{
  const turns=Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',text:`turn-${i}`,modality:'text'}));
  const m=fuseMultimodalContext({visualObservation:visual(),speechText:'这个怎么办？',conversation:turns});
  assert.equal(m.priorTurns.length,8);
  assert.equal(m.priorTurns.at(-1).text,'turn-19');
});

test('image-only input still creates multimodal context without inventing speech',()=>{
  const m=fuseMultimodalContext({visualObservation:visual({type:'receipt'}),speechText:''});
  assert.equal(m.modalities.image,true);
  assert.equal(m.modalities.speech,false);
  assert.equal(m.speech.rawText,'');
  assert.equal(m.userIntent.value,'explain_observation');
});

test('voice-only context declares missing visual input',()=>{
  const m=fuseMultimodalContext({visualObservation:null,speechText:'这个是什么？'});
  assert.equal(m.modalities.image,false);
  assert.equal(m.modalities.speech,true);
  assert.ok(m.unknowns.some(x=>x.id==='visual.input'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {planNextBestVisualEvidence} from '../core/vision/next-best-visual-evidence.js';
import {understandProblem} from '../core/resolution/problem-understanding.js';
import {planResolution} from '../core/resolution/resolution-router.js';

function observation({missing=[],type='object',confidence=.85}={}){
  return {
    detectedType:type,confidence:{overall:confidence},limitations:[],localResolutionPossible:false,
    observations:[
      {kind:'structured_facts',facts:[]},
      {kind:'visual_capability_plan',route:{missingCapabilities:missing,needsVisionTeacher:missing.length>0}},
    ],
  };
}

test('specific identity gap asks for label/nameplate evidence instead of guessing',()=>{
  const p=planNextBestVisualEvidence({missingCapabilities:['specific_identity']});
  assert.equal(p.needed,true);
  assert.equal(p.requests.length,1);
  assert.equal(p.requests[0].target,'identity_marker');
  assert.match(p.requests[0].instruction,/品牌|型号|铭牌|MODEL/);
});

test('grounding gap has higher priority than model identity gap',()=>{
  const p=planNextBestVisualEvidence({missingCapabilities:['specific_identity','visual_grounding']});
  assert.equal(p.requests[0].capability,'visual_grounding');
});

test('unknown non-visual capability does not invent capture guidance',()=>{
  const p=planNextBestVisualEvidence({missingCapabilities:['fresh_web_price']});
  assert.equal(p.needed,false);
  assert.equal(p.requests.length,0);
});

test('brand/model question collects decisive visual evidence before teacher escalation',()=>{
  const o=observation({missing:['specific_identity']});
  const problem=understandProblem(o,{userQuestion:'这是什么品牌和具体型号？'});
  const r=planResolution({observation:o,problem});
  assert.equal(r.decision,'need_more_evidence');
  assert.equal(r.reasons[0],'actionable_visual_evidence_gap');
  assert.equal(r.evidenceGap.nextBestTarget,'identity_marker');
  assert.match(r.nextEvidence[0].instruction,/型号|铭牌/);
});

test('visual gap request remains a single next-best action to reduce user burden',()=>{
  const o=observation({missing:['specific_identity','scene_context','component_parts']});
  const problem=understandProblem(o,{userQuestion:'这是什么型号？'});
  const r=planResolution({observation:o,problem});
  assert.equal(r.nextEvidence.length,1);
});

test('non-actionable missing capability can still escalate instead of looping on photos',()=>{
  const o=observation({missing:['general_vision']});
  const problem=understandProblem(o,{userQuestion:'帮我分析'});
  const r=planResolution({observation:o,problem});
  assert.equal(r.decision,'teacher_or_tool');
});

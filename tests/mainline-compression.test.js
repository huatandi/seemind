import test from 'node:test';
import assert from 'node:assert/strict';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

function observation(){
 return {
  id:'obs-1',detectedType:'object',extractedText:'',limitations:[],
  confidence:{overall:.82,identity:.8,fact:0,evidence:.8,recommendation:0,action:.3},
  localResolutionPossible:false,
  observations:[
   {kind:'visual_capability_plan',schemaVersion:1,route:{missingCapabilities:[],needsVisionTeacher:false}},
   {kind:'general_vision',providerId:'p',identity:[{label:'router',confidence:.9,status:'observed'}],scene:[],states:[],anomalies:[]},
  ],
  problem:{
   schemaVersion:1,detectedType:'object',userQuestion:null,
   intentHypotheses:[{intent:'explain_observation',confidence:.68}],
   knownFacts:[],candidateFacts:[],unknownFacts:[],symptoms:[],attemptedActions:[],temporalContext:[],referencedObjects:[],multimodalUnknowns:[],problemSignals:[],confidence:{observation:.82,intent:.68},
  },
  resolution:{
   schemaVersion:1,decision:'teacher_or_tool',canExplainNow:true,canOfferSolutionNow:false,
   reasons:['solution_requires_more_than_current_local_evidence'],nextEvidence:[],
   escalation:{needed:true,preferredKinds:['reasoning'],sendPolicy:'minimum_necessary'},
  },
 };
}

test('multimodal fusion reuses existing visual plan when no new language exists',()=>{
 const mm=fuseMultimodalContext({visualObservation:observation()});
 assert.equal(mm.visualPlan.reused,true);
 assert.equal(mm.visualPlan.reuseReason,'NO_NEW_LANGUAGE_CONTEXT');
});

test('new language forces a fresh visual-language plan instead of stale reuse',()=>{
 const mm=fuseMultimodalContext({visualObservation:observation(),textInput:'右边这个是什么？'});
 assert.notEqual(mm.visualPlan.reused,true);
});

test('initial universal explanation reuses perception Problem and Resolution',()=>{
 const out=buildUniversalExplanation({observation:observation(),availableTeachers:[],searchAvailable:false});
 assert.equal(out.mainlineCompression.reusedPerceptionProblem,true);
 assert.equal(out.mainlineCompression.reusedPerceptionResolution,true);
 assert.equal(out.mainlineCompression.reusedVisualPlan,true);
});

test('user question invalidates cached perception Problem/Resolution and recomputes multimodal meaning',()=>{
 const out=buildUniversalExplanation({observation:observation(),textInput:'为什么它不工作？',availableTeachers:[],searchAvailable:false});
 assert.equal(out.mainlineCompression.userQuestionPresent,true);
 assert.equal(out.mainlineCompression.reusedPerceptionProblem,false);
 assert.equal(out.mainlineCompression.reusedPerceptionResolution,false);
 assert.equal(out.problem.userQuestion,'为什么它不工作？');
});

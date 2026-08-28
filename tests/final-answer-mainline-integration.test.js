import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUniversalExplanation,renderUniversalExplanationHtml} from '../core/explanation/universal-explainer.js';
import {createProblemSolvingSession} from '../core/resolution/problem-solving-session.js';
import {withEvidenceSemantics} from '../core/evidence/evidence-semantics.js';

test('universal explanation exposes temporal fact view and epistemic final-answer contract on mainline',()=>{
  const old=withEvidenceSemantics({id:'old',entityId:'e1',type:'state',value:'green',source:'photo',confidence:.9},{evidenceKind:'observation',observedAt:'2026-08-25T10:00:00.000Z'});
  old.semantics.lifecycleState='superseded';
  const cur=withEvidenceSemantics({id:'cur',entityId:'e1',type:'state',value:'red',source:'photo',confidence:.9},{evidenceKind:'observation',observedAt:'2026-08-26T10:00:00.000Z'});
  const state=createProblemSolvingSession({evidenceGraph:{activeEntityId:'e1',entities:[{id:'e1',photoIds:[]}],photos:[],claims:[old,cur]}});
  const x=buildUniversalExplanation({observation:{observations:[]},textInput:'这是什么状态？',problemState:state});
  assert.equal(x.factView.current.state.value,'red');
  assert.equal(x.epistemicAnswer.historicalFacts.some(v=>v.value==='green'),true);
  assert.equal(x.problemState.factSnapshot.current.state.value,'red');
});

test('user-facing renderer labels historical evidence instead of silently mixing it into current prose',()=>{
  const old=withEvidenceSemantics({id:'old',entityId:'e1',type:'price',value:'99',source:'photo',confidence:.9},{evidenceKind:'observation',observedAt:'2026-08-25T10:00:00.000Z'});
  old.semantics.lifecycleState='superseded';
  const state=createProblemSolvingSession({evidenceGraph:{activeEntityId:'e1',entities:[{id:'e1',photoIds:[]}],photos:[],claims:[old]}});
  const x=buildUniversalExplanation({observation:{observations:[]},textInput:'多少钱？',problemState:state});
  assert.match(renderUniversalExplanationHtml(x),/历史信息/);
});

test('text-only follow-up does not create a phantom photo or switch active entity',()=>{
  const state=createProblemSolvingSession({evidenceGraph:{activeEntityId:'e1',entities:[{id:'e1',photoIds:[]}],photos:[],claims:[]}});
  const x=buildUniversalExplanation({observation:{},textInput:'继续说这个',problemState:state});
  assert.equal(x.problemState.evidenceGraph.activeEntityId,'e1');
  assert.equal(x.problemState.evidenceGraph.photos.length,0);
});

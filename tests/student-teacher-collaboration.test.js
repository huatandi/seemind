import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudentBriefing} from '../core/collaboration/student-briefing.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {TeacherProvider} from '../core/teacher/teacher-provider.js';
import {createTeacherOutcomeStore,learnTeacherOutcome} from '../core/orchestration/intelligence-gap-router.js';
import {rankTeachers} from '../core/teacher/teacher-router.js';
import {GatewayTeacherRegistry} from '../gateway/core/teacher-registry.js';
import {GatewayTeacherManager} from '../gateway/core/teacher-manager.js';

const field=(field,value,confidence,extra={})=>({id:`ev-${field}`,field,value,confidence,rule:'TEST',sourceText:field,...extra});
const receipt={merchant:field('merchant','TIENDA',.55),date:field('date','2026-08-25',.95),subtotal:field('subtotalMinor',10000,.92),tax:field('taxMinor',800,.92),total:field('totalMinor',null,0),cash:field('cashMinor',12000,.9),change:field('changeMinor',1200,.9),checks:[{id:'subtotal-tax-total',status:'conflicted',expectedMinor:10800,actualMinor:10900,deltaMinor:100}]};
const observation={detectedType:'receipt_candidate',confidence:{overall:.72},limitations:['TOTAL unclear']};

test('Student briefing separates known uncertain and unknown instead of flattening confidence',()=>{
  const b=createStudentBriefing({observation,receipt,userIntent:'总额是多少？'});
  assert.ok(b.known.some(x=>x.field==='date'));
  assert.ok(b.uncertain.some(x=>x.field==='merchant'));
  assert.ok(b.unknown.some(x=>x.field==='totalMinor'));
  assert.ok(b.teacherQuestions.some(x=>/totalMinor/i.test(x)));
});

test('compiled package contains collaboration brief for Teacher focus',()=>{
  const p=compileTaskPackage({task:{type:'question_about_observation'},observation,receipt,userIntent:'帮我确认总额'});
  assert.equal(p.schemaVersion,2);
  assert.ok(p.collaboration);
  assert.ok(p.collaboration.focus.some(x=>x.field==='totalMinor'));
});

class P extends TeacherProvider{constructor(id){super(id,{capabilities:[{capability:'reasoning',score:.9}],supportedLanguages:['zh-CN'],privacyModes:['cloud'],reliabilityScore:.8,evidenceScore:.8,freshnessScore:.8,historicalSuccess:.5,latencyClass:'medium'});}async healthCheck(){return {status:'ready'}}}

test('router can learn task-specific Teacher success without changing Provider profile',async()=>{
  const outcomes=createTeacherOutcomeStore();
  for(let i=0;i<8;i++)learnTeacherOutcome(outcomes,{providerId:'a',capabilities:['reasoning'],taskKind:'question_about_observation',technicalOk:true,verified:i<2,userCorrected:i>=2,latencyMs:7000});
  for(let i=0;i<8;i++)learnTeacherOutcome(outcomes,{providerId:'b',capabilities:['reasoning'],taskKind:'question_about_observation',technicalOk:true,verified:i<7,userCorrected:i>=7,latencyMs:1200});
  const pkg={task:{type:'question_about_observation',requiredCapabilities:['reasoning'],language:'zh-CN'},constraints:[],safety:{sensitiveData:false}};
  const ranked=await rankTeachers(pkg,[new P('a'),new P('b')],{consent:true,outcomeStore:outcomes});
  assert.equal(ranked[0].provider.id,'b');
  assert.ok(ranked[0].components.historicalSuccess>ranked[1].components.historicalSuccess);
});

test('gateway health exposes aggregated success rate and latency but not errors',()=>{
  let now=1000;const registry=new GatewayTeacherRegistry([{id:'teacher-a'}]);const m=new GatewayTeacherManager({registry,clock:()=>now});
  m.recordSuccess('teacher-a',{latencyMs:100});now+=10;m.recordFailure('teacher-a',new Error('secret upstream detail'),{latencyMs:300});
  const s=m.publicState('teacher-a');assert.equal(s.attempts,2);assert.equal(s.successRate,.5);assert.equal(s.avgLatencyMs,200);assert.equal('lastError' in s,false);
});

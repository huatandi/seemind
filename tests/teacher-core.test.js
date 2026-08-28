import test from 'node:test';import assert from 'node:assert/strict';
import {TeacherProvider} from '../core/teacher/teacher-provider.js';
import {TeacherRegistry} from '../core/teacher/teacher-registry.js';
import {selectTeacher} from '../core/teacher/teacher-router.js';
import {askTeacher} from '../core/teacher/teacher-orchestrator.js';
class P extends TeacherProvider{constructor(id,caps,priority=0,status='ready'){super(id);this.caps=caps;this.priority=priority;this.status=status}getCapabilities(){return this.caps}async healthCheck(){return {status:this.status}}async execute(){return {answer:'grounded answer',evidenceRefs:[],actions:[]}}}
const pkg={task:{requiredCapabilities:['reasoning']},userIntent:'解释',evidence:[],safety:{sensitiveData:true}};
test('registry registers providers',()=>{const r=new TeacherRegistry([new P('a',['reasoning'])]);assert.equal(r.get('a').id,'a')});
test('router selects healthy capable highest priority teacher',async()=>{const x=await selectTeacher(pkg,[new P('low',['reasoning'],1),new P('high',['reasoning'],5),new P('bad',['reasoning'],99,'down')]);assert.equal(x.id,'high')});
test('teacher call is blocked without consent for sensitive package',async()=>{const r=await askTeacher({taskPackage:pkg,providers:[new P('a',['reasoning'])],consent:false});assert.equal(r.code,'CONSENT_REQUIRED')});
test('teacher output is validated before returning',async()=>{const r=await askTeacher({taskPackage:pkg,providers:[new P('a',['reasoning'])],consent:true});assert.equal(r.status,'ok');assert.equal(r.result.answer,'grounded answer')});
test('invalid teacher output never becomes answer',async()=>{class Bad extends P{async execute(){return {answer:''}}}const r=await askTeacher({taskPackage:pkg,providers:[new Bad('bad',['reasoning'])],consent:true});assert.equal(r.status,'invalid')});

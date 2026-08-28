import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudentObservation} from '../core/observation/student-observation.js';
import {createTask} from '../core/task/task.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';

test('StudentObservation preserves supplied confidence and limitations',()=>{
  const o=createStudentObservation({confidence:{overall:.91},limitations:['x'],localResolutionPossible:true});
  assert.equal(o.confidence.overall,.91);assert.deepEqual(o.limitations,['x']);assert.equal(o.localResolutionPossible,true);
});

test('Unified Orchestrator is the only local-versus-teacher routing authority',()=>{
  const task=createTask({type:'receipt_parse',userIntent:'receipt'});
  const base={task,safety:{risk:{}},evidence:{request:{},analysis:{},consensus:{}},retrieval:{packageSearch:{}},planning:{intentPlan:{}},understanding:{},external:{teacherCount:1,searchAvailable:false,plannerAvailable:false}};
  assert.equal(orchestrate({context:{...base,evidence:{...base.evidence,resolution:{decision:'local_explain'}},retrieval:{...base.retrieval,plan:{localCanAnswer:true}}}}).route,'LOCAL');
  assert.equal(orchestrate({context:{...base,evidence:{...base.evidence,resolution:{escalation:{needed:true}}},retrieval:{...base.retrieval,plan:{}}}}).route,'TEACHER');
});

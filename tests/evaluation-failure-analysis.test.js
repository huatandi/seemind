import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableAuditLog,MemoryAuditEventStore} from '../core/audit/durable-event-log.js';
import {evaluateAuditTrail,FAILURE_CATEGORIES} from '../core/evaluation/evaluator.js';
import {createImprovementCandidate,transitionCandidate,canPromoteCandidate} from '../core/evaluation/improvement-candidate.js';
import {evaluateExecution} from '../core/evaluation/evaluation-pipeline.js';

test('evaluation classifies provider timeout separately from teacher quality',()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store,executionId:'e1',taskId:'t1'});
  audit.record('planner_graph_started',{});audit.record('teacher_error',{providerId:'teacher-a',error:'request timeout'});audit.record('planner_graph_stopped',{state:'failed',reason:'NODE_FAILED'});
  const result=evaluateAuditTrail(audit.list());
  assert.equal(result.primaryFailure.category,FAILURE_CATEGORIES.PROVIDER);assert.equal(result.primaryFailure.code,'PROVIDER_TIMEOUT');assert.equal(result.taskSolved,false);
});

test('evaluation recognizes evidence conflict as evidence failure',()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store,executionId:'e2',taskId:'t2'});
  audit.record('planner_graph_started',{});audit.record('evidence_consensus',{status:'conflicted',resolutionStatus:'unresolved'});audit.record('planner_graph_blocked',{reason:'ASK_USER'});
  const result=evaluateAuditTrail(audit.list());
  assert.ok(result.findings.some(x=>x.category===FAILURE_CATEGORIES.EVIDENCE));assert.equal(result.recommendation,'retrieve_better_evidence');
});

test('teacher schema invalid is contract failure, not generic provider failure',()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store,executionId:'e3',taskId:'t3'});
  audit.record('teacher_invalid',{providerId:'teacher-a',issues:['schema required field missing']});
  const result=evaluateAuditTrail(audit.list());assert.equal(result.primaryFailure.category,FAILURE_CATEGORIES.CONTRACT);
});

test('completed clean execution evaluates as solved',()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store,executionId:'e4',taskId:'t4'});
  audit.record('planner_graph_started',{});audit.record('result_accepted',{providerId:'teacher-a'});audit.record('planner_graph_completed',{});
  const result=evaluateAuditTrail(audit.list());assert.equal(result.taskSolved,true);assert.equal(result.score,100);assert.equal(result.recommendation,'accept');
});

test('improvement candidate cannot jump directly into production',()=>{
  const evaluation={evaluationId:'ev',taskId:'t',executionId:'e',primaryFailure:{category:'router_error',code:'NO_ROUTER_CANDIDATE'},findings:[]};
  let candidate=createImprovementCandidate({evaluation});assert.equal(candidate.stage,'proposed');assert.equal(canPromoteCandidate(candidate).ok,false);
  assert.throws(()=>transitionCandidate(candidate,'promoted'),/INVALID_CANDIDATE_TRANSITION/);
  candidate=transitionCandidate(candidate,'offline_evaluated');candidate=transitionCandidate(candidate,'regression_passed');
  assert.throws(()=>transitionCandidate(candidate,'approved'),/EXPLICIT_APPROVAL_REQUIRED/);
  candidate=transitionCandidate(candidate,'approved',{approval:true});assert.equal(canPromoteCandidate(candidate).ok,true);candidate=transitionCandidate(candidate,'promoted');assert.equal(candidate.stage,'promoted');
});

test('evaluation pipeline records safe evaluation metadata and proposes candidate',()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store,executionId:'e5',taskId:'t5'});
  audit.record('planner_graph_started',{});audit.record('teacher_error',{providerId:'teacher-a',error:'network failure'});audit.record('planner_graph_stopped',{state:'failed',reason:'NODE_FAILED'});
  const out=evaluateExecution({audit,executionId:'e5',taskId:'t5'});assert.ok(out.candidate);assert.equal(out.candidate.stage,'proposed');
  const events=audit.list({executionId:'e5'});assert.ok(events.some(x=>x.type==='evaluation_completed'));assert.ok(events.some(x=>x.type==='improvement_candidate_proposed'));
});

import {recordOfflineEvaluation,recordRegressionResult,approveCandidate,promoteCandidate} from '../core/evaluation/candidate-governance.js';

test('candidate governance requires offline evaluation, regression and explicit approval',()=>{
  const evaluation={evaluationId:'ev-gate',taskId:'t',executionId:'e',primaryFailure:{category:'router_error',code:'NO_ROUTER_CANDIDATE'},findings:[]};
  let c=createImprovementCandidate({evaluation});
  assert.throws(()=>promoteCandidate(c),/CANDIDATE_NOT_APPROVED/);
  c=recordOfflineEvaluation(c,{baselineScore:70,candidateScore:76,caseCount:50});assert.equal(c.stage,'offline_evaluated');
  c=recordRegressionResult(c,{passed:true,total:120,failed:0});assert.equal(c.stage,'regression_passed');
  assert.throws(()=>approveCandidate(c,{approved:false}),/EXPLICIT_APPROVAL_REQUIRED/);
  c=approveCandidate(c,{approved:true,reviewer:'owner'});assert.equal(c.stage,'approved');
  c=promoteCandidate(c,{releaseId:'v-next'});assert.equal(c.stage,'promoted');assert.equal(c.promotion.releaseId,'v-next');
});

test('critical regression rejects candidate instead of auto-promoting it',()=>{
  const evaluation={evaluationId:'ev-reject',taskId:'t',executionId:'e',primaryFailure:{category:'evidence_failure',code:'EVIDENCE_INSUFFICIENT'},findings:[]};
  let c=createImprovementCandidate({evaluation});c=recordOfflineEvaluation(c,{baselineScore:80,candidateScore:84,caseCount:20});
  c=recordRegressionResult(c,{passed:false,total:100,failed:1,criticalRegressions:['receipt_total_wrong']});assert.equal(c.stage,'rejected');assert.equal(canPromoteCandidate(c).ok,false);
});

test('explicit user feedback can classify an otherwise invisible wrong entity failure',()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store,executionId:'e-feedback',taskId:'t-feedback'});
  audit.record('planner_graph_started',{});audit.record('planner_graph_completed',{});audit.record('user_feedback',{type:'wrong',category:'wrong_entity'});
  const result=evaluateAuditTrail(audit.list());assert.ok(result.findings.some(x=>x.category===FAILURE_CATEGORIES.ENTITY&&x.code==='USER_WRONG_ENTITY'));
});

import {createTask} from '../core/task/task.js';
import {createPlannerExecution,executePlannerExecution} from '../core/planning/planner-execution-orchestrator.js';

test('planner execution automatically attaches offline evaluation without changing production rules',async()=>{
  const store=new MemoryAuditEventStore(),audit=new DurableAuditLog({store});
  const task=createTask({type:'general_qa',userIntent:'private'});const pkg={schemaVersion:2,task,userIntent:'private',evidence:[],entities:[],privacy:{},safety:{sensitiveData:false}};
  const execution=createPlannerExecution({taskPackage:pkg,audit,handlers:{resolve_task:async({context})=>{context.result={answer:'ok'};return {output:context.result}}}});
  const out=await executePlannerExecution(execution);assert.equal(out.status,'completed');assert.ok(out.evaluation);assert.equal(out.evaluation.taskSolved,true);assert.equal(out.improvementCandidate,null);
  assert.ok(store.list({executionId:execution.id}).some(x=>x.type==='evaluation_completed'));
});

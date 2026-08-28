import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationSession,attachObservation,addTurn} from '../core/session/conversation-session.js';
import {orchestrate} from '../core/orchestration/unified-orchestrator.js';
import {createTaskPackage} from '../core/task/task-package.js';

test('conversation session keeps visual context and spoken/text turns',()=>{const s=createConversationSession({id:'s1'});attachObservation(s,{id:'o1',modality:'image'});addTurn(s,{role:'user',text:'这是什么？',modality:'voice'});assert.equal(s.observations[0].id,'o1');assert.equal(s.turns[0].text,'这是什么？')});
test('question about observation can route to Teacher only through Unified Orchestrator',()=>{const context={task:{type:'question_about_observation'},safety:{risk:{}},evidence:{resolution:{escalation:{needed:true}},request:{},analysis:{},consensus:{}},retrieval:{plan:{},packageSearch:{}},planning:{intentPlan:{}},understanding:{},external:{teacherCount:1,searchAvailable:false,plannerAvailable:false}};assert.equal(orchestrate({context}).route,'TEACHER')});
test('teacher package includes recent conversation without provider binding',()=>{const pkg=createTaskPackage({task:{type:'question_about_observation'},observation:{schemaVersion:1,modality:'image',detectedType:'receipt',extractedText:'TOTAL 10',confidence:{},limitations:[]},userIntent:'这是多少钱？',conversation:[{role:'user',text:'这是多少钱？'}]});assert.equal(pkg.outputSchema,'grounded_answer_v1');assert.equal(pkg.conversation.length,1);assert.equal(pkg.safety.cloudAllowed,false)});

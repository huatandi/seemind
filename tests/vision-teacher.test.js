import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionAttachment,validateVisionAttachment,withVisionAttachments,stripVisionData} from '../core/vision/vision-attachment.js';
import {sanitizeTaskPackage} from '../core/privacy/task-package-sanitizer.js';
import {buildTeacherMessages} from '../gateway/core/task-prompt.js';
import {validateTeacherResult} from '../core/teacher/teacher-result-validator.js';
import {GatewayTeacherRegistry} from '../gateway/core/teacher-registry.js';
import {GatewayTeacherManager} from '../gateway/core/teacher-manager.js';
import {GatewayService} from '../gateway/core/gateway-service.js';

const tiny='data:image/jpeg;base64,/9j/AA==';
const image=createVisionAttachment({id:'img-1',mimeType:'image/jpeg',width:20,height:10,byteLength:7,dataUrl:tiny});

test('vision attachment validates and metadata can be stripped',()=>{
 assert.equal(validateVisionAttachment(image).ok,true);
 const stripped=stripVisionData(withVisionAttachments({task:{}},[image]));
 assert.equal(stripped.media[0].id,'img-1');assert.equal('dataUrl' in stripped.media[0],false);
});

test('privacy sanitizer never sends image unless explicitly allowed',()=>{
 const pkg=withVisionAttachments({observations:[],evidence:[],conversation:[]},[image]);
 assert.equal(sanitizeTaskPackage(pkg,{allowImages:false}).package.media.length,0);
 assert.equal(sanitizeTaskPackage(pkg,{allowImages:true}).package.media[0].dataUrl,tiny);
});

test('teacher prompt becomes multimodal only when media exists',()=>{
 const textOnly=buildTeacherMessages({task:{type:'x'},media:[]});assert.equal(typeof textOnly[1].content,'string');
 const multimodal=buildTeacherMessages({task:{type:'x'},media:[image]});assert.ok(Array.isArray(multimodal[1].content));assert.equal(multimodal[1].content[1].type,'image_url');
});

test('visual claim may cite image attachment id as evidence',()=>{
 const pkg={contract:{requireClaims:true},evidence:[],media:[image]};
 const result=validateTeacherResult({answer:'图中有一个物体',claims:[{id:'c1',text:'图中有一个物体',type:'fact',status:'supported',confidence:.8,evidenceRefs:['img-1']}],evidenceRefs:['img-1']},pkg);
 assert.equal(result.ok,true);
});

test('teacher manager opens circuit after repeated failures and recovers to half-open',()=>{
 let now=1000;const registry=new GatewayTeacherRegistry([{id:'teacher-a'}]);const manager=new GatewayTeacherManager({registry,failureThreshold:2,cooldownMs:1000,clock:()=>now});
 manager.recordFailure('teacher-a',new Error('x'));assert.equal(manager.publicState('teacher-a').status,'degraded');
 manager.recordFailure('teacher-a',new Error('x'));assert.equal(manager.publicState('teacher-a').status,'circuit_open');assert.equal(manager.canExecute('teacher-a'),false);
 now=2200;assert.equal(manager.publicState('teacher-a').status,'half_open');assert.equal(manager.canExecute('teacher-a'),true);
 manager.recordSuccess('teacher-a');assert.equal(manager.publicState('teacher-a').status,'ready');
});

test('gateway blocks image for a teacher without vision capability',async()=>{
 const registry=new GatewayTeacherRegistry([{id:'teacher-a',protocol:'openai-compatible',endpoint:'https://x/v1',model:'m',capabilities:['reasoning']}]);
 const service=new GatewayService({registry,fetchImpl:async()=>{throw new Error('must not call upstream')}});
 await assert.rejects(()=>service.execute({requestId:'r',providerId:'teacher-a',taskPackage:{media:[image]}}),e=>e.code==='TEACHER_NO_VISION');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGatewayConfig} from '../gateway/core/runtime-config.js';
import {GatewayTeacherRegistry} from '../gateway/core/teacher-registry.js';
import {GatewayService} from '../gateway/core/gateway-service.js';
import {discoverGatewayTeachers} from '../providers/gateway/gateway-discovery.js';

const env={
 SEEMIND_TEACHER_A_ENABLED:'true',SEEMIND_TEACHER_A_ENDPOINT:'https://teacher.example/v1',SEEMIND_TEACHER_A_MODEL:'model-a',SEEMIND_TEACHER_A_API_KEY:'super-secret',
 SEEMIND_TEACHER_B_ENABLED:'false'
};

test('gateway config keeps teacher secret server side',()=>{
 const c=loadGatewayConfig(env); assert.equal(c.teachers.length,1); assert.equal(c.teachers[0].apiKey,'super-secret');
 const pub=new GatewayTeacherRegistry(c.teachers).listPublic()[0]; assert.equal('apiKey' in pub,false); assert.equal(pub.id,'teacher-a');
});

test('gateway service calls configured upstream and parses structured answer',async()=>{
 let seen;
 const cfg=loadGatewayConfig(env); const registry=new GatewayTeacherRegistry(cfg.teachers);
 const fetchImpl=async(url,options)=>{seen={url,options};return {ok:true,status:200,json:async()=>({choices:[{message:{content:JSON.stringify({answer:'知道了',claims:[],evidenceRefs:[],uncertainty:[],actions:[]})}}]})}};
 const service=new GatewayService({registry,fetchImpl});
 const out=await service.execute({requestId:'r1',providerId:'teacher-a',taskPackage:{task:{type:'general_qa'}}});
 assert.equal(out.requestId,'r1'); assert.equal(out.result.answer,'知道了'); assert.equal(seen.options.headers.authorization,'Bearer super-secret'); assert.match(seen.url,/chat\/completions$/);
});

test('gateway public discovery creates browser providers without secrets',async()=>{
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>({teachers:[{id:'teacher-a',model:'m',capabilities:['reasoning'],languages:['zh-CN'],reliability:.9}]})});
 const providers=await discoverGatewayTeachers('http://127.0.0.1:8787',{fetchImpl});
 assert.equal(providers.length,1); assert.equal(providers[0].id,'teacher-a'); assert.equal(providers[0].getProfile().model,'m');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {GatewayService} from '../gateway/core/gateway-service.js';
import {GatewayTeacherRegistry} from '../gateway/core/teacher-registry.js';

const teacher={id:'a',publicName:'A',provider:'x',model:'m',protocol:'openai-compatible',endpoint:'https://example.test',apiKey:'secret',capabilities:['reasoning'],languages:['zh'],privacyModes:['cloud']};

test('gateway replays same teacher requestId without calling upstream twice',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'ok',claims:[],evidence:[]})}}]}),{status:200,headers:{'content-type':'application/json'}})};
  const service=new GatewayService({registry:new GatewayTeacherRegistry([teacher]),fetchImpl});const req={requestId:'stable-1',providerId:'a',taskPackage:{task:{type:'general_qa'},userIntent:'x',answerContract:{},evidence:[]}};
  const a=await service.execute(req),b=await service.execute(req);assert.equal(calls,1);assert.deepEqual(a,b);
});

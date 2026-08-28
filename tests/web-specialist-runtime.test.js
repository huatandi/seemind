import test from 'node:test';import assert from 'node:assert/strict';
import {createWebCapabilityExecutors} from '../apps/web/src/runtime/web-capability-executors.js';
function provider(id,score){return {id,getProfile(){return {capabilities:[{capability:'reasoning',score}],privacyModes:['local'],reliabilityScore:score,evidenceScore:score,historicalSuccess:score,latencyClass:'fast',costClass:'free'}},async healthCheck(){return {status:'ready'}},async execute(){return {answer:id,claims:[],uncertainty:null,evidenceRefs:[],actions:[]}}}}
test('web teacher runtime promotes specialist capability ranking before teacher execution',async()=>{
 let pkg={task:{id:'t1',type:'question',requiredCapabilities:['reasoning']},userIntent:'x',safety:{sensitiveData:false}};
 const ex=createWebCapabilityExecutors({getTaskPackage:()=>pkg,setTaskPackage:x=>pkg=x,getObservation:()=>({observations:[]}),getVisionAttachment:()=>null,getConversation:()=>[],getProviders:()=>[provider('weak',.2),provider('strong',.95)],getVerifiedEntity:()=>null,setVerifiedEntity:()=>{},requestConsent:async()=>true});
 const r=await ex.TEACHER();assert.equal(r.status,'completed');assert.equal(r.result.providerId,'strong');
});

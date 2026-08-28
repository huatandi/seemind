import test from 'node:test';
import assert from 'node:assert/strict';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {validateTeacherResult} from '../core/teacher/teacher-result-validator.js';
import {createGatewayRequest,validateGatewayResponse} from '../core/gateway/gateway-contract.js';
import {HttpGatewayTeacherProvider} from '../providers/gateway/http-gateway-teacher.js';
import {TeacherProvider} from '../core/teacher/teacher-provider.js';
import {askTeacher} from '../core/teacher/teacher-orchestrator.js';

const evidence={id:'ev-total',field:'total',value:65638,confidence:.96};
const baseTask={id:'t1',type:'question_about_observation',userIntent:'总额是多少',requiredCapabilities:['reasoning'],language:'zh-CN'};
const pkg=compileTaskPackage({task:baseTask,observation:{schemaVersion:1,modality:'image',extractedText:'TOTAL $656.38',confidence:{overall:.9},limitations:[]},receipt:{total:evidence},userIntent:'总额是多少'});

test('compiler creates v2 package with answer contract',()=>{assert.equal(pkg.schemaVersion,2);assert.equal(pkg.contract.requireClaims,true);assert.equal(pkg.contract.requireEvidenceForFacts,true)});
test('supported factual claim passes judge',()=>{const r=validateTeacherResult({answer:'总额是 656.38 MXN',claims:[{id:'c1',text:'总额是 656.38 MXN',type:'fact',status:'supported',confidence:.95,evidenceRefs:['ev-total']}],evidenceRefs:['ev-total']},pkg);assert.equal(r.ok,true)});
test('unsupported factual claim is rejected',()=>{const r=validateTeacherResult({answer:'商户是 Walmart',claims:[{id:'c2',text:'商户是 Walmart',type:'fact',status:'supported',confidence:.9,evidenceRefs:[]}]},pkg);assert.equal(r.ok,false);assert.ok(r.issues.some(x=>x.startsWith('unsupported_fact:')))});
test('unknown evidence reference is rejected',()=>{const r=validateTeacherResult({answer:'总额',claims:[{id:'c3',text:'总额',type:'fact',status:'supported',confidence:.9,evidenceRefs:['made-up']}],evidenceRefs:[]},pkg);assert.equal(r.ok,false);assert.ok(r.issues.some(x=>x.startsWith('unknown_evidence_ref:')))});
test('gateway contract binds request and result',()=>{const q=createGatewayRequest({providerId:'g',taskPackage:pkg,requestId:'r1'});assert.equal(q.requestId,'r1');assert.equal(validateGatewayResponse({requestId:'r1',result:{answer:'x'}},'r1').ok,true);assert.equal(validateGatewayResponse({requestId:'r2',result:{answer:'x'}},'r1').ok,false)});
test('gateway provider sends no browser api key headers',async()=>{let seen;const fetchImpl=async(url,options={})=>{seen={url,options};if(url.endsWith('/health'))return {ok:true,status:200};return {ok:true,status:200,json:async()=>({requestId:JSON.parse(options.body).requestId,result:{answer:'ok'}})}};const p=new HttpGatewayTeacherProvider({id:'g',gatewayUrl:'https://gateway.example',profile:{capabilities:['reasoning']},fetchImpl});await p.execute(pkg);assert.equal(seen.options.headers.authorization,undefined);assert.equal(seen.options.headers['x-api-key'],undefined)});

test('orchestrator falls back when first teacher has unsupported fact',async()=>{
 class P extends TeacherProvider{constructor(id,bad,score){super(id,{capabilities:[{capability:'reasoning',score}],supportedLanguages:['zh-CN'],privacyModes:['local'],reliabilityScore:score,evidenceScore:score,freshnessScore:score,historicalSuccess:score});this.bad=bad}async healthCheck(){return {status:'ready'}}async execute(){return this.bad?{answer:'猜 Walmart',claims:[{id:'bad',text:'商户是 Walmart',type:'fact',status:'supported',confidence:.9,evidenceRefs:[]}]}:{answer:'只能确认总额',claims:[{id:'good',text:'总额是 656.38 MXN',type:'fact',status:'supported',confidence:.9,evidenceRefs:['ev-total']}]}}}
 const r=await askTeacher({taskPackage:pkg,providers:[new P('bad',true,.95),new P('good',false,.8)],consent:false,budget:{maxTeacherCalls:2,maxFallbacks:1,maxLatencyMs:30000}});assert.equal(r.status,'ok');assert.equal(r.providerId,'good');assert.equal(r.attempts.length,2)
});

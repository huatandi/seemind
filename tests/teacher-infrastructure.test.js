import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherProvider} from '../core/teacher/teacher-provider.js';
import {rankTeachers} from '../core/teacher/teacher-router.js';
import {askTeacher} from '../core/teacher/teacher-orchestrator.js';
import {sanitizeTaskPackage,redactText} from '../core/privacy/task-package-sanitizer.js';
import {ProviderConfigStore} from '../core/config/provider-config.js';
import {InMemoryTeacherAudit} from '../core/audit/teacher-audit.js';

class P extends TeacherProvider{
  constructor(id,{score=.8,latencyClass='medium',privacyModes=['cloud'],fail=false,invalid=false}={}){super(id,{capabilities:[{capability:'reasoning',score}],supportedLanguages:['zh-CN'],privacyModes,latencyClass,costClass:'low',reliabilityScore:score,evidenceScore:score,freshnessScore:score,historicalSuccess:score});this.fail=fail;this.invalid=invalid}
  async healthCheck(){return {status:'ready'}}
  async estimate(){return {estimatedCost:.01,estimatedLatencyMs:50}}
  async execute(){if(this.fail)throw new Error('boom');return this.invalid?{answer:''}:{answer:`ok:${this.id}`,evidenceRefs:[],actions:[]}}
}
const pkg={task:{requiredCapabilities:['reasoning'],language:'zh-CN'},userIntent:'解释',observations:[{extractedText:'邮箱 a@b.com 卡 4111111111111111'}],conversation:[{text:'联系 686 123 4567'}],evidence:[],constraints:['Use evidence'],safety:{sensitiveData:true}};

test('sanitizer redacts common sensitive text',()=>{assert.match(redactText('a@b.com 4111111111111111'),/REDACTED_EMAIL/);assert.match(redactText('a@b.com 4111111111111111'),/REDACTED_CARD/)});
test('sanitizer keeps minimum necessary bounded context',()=>{const s=sanitizeTaskPackage(pkg,{includeConversationTurns:1});assert.doesNotMatch(s.package.observations[0].extractedText,/a@b.com/);assert.equal(s.package.conversation.length,1)});
test('router ranks stronger and faster capable teacher higher',async()=>{const ranked=await rankTeachers({...pkg,safety:{sensitiveData:false}},[new P('weak',{score:.4,latencyClass:'slow'}),new P('strong',{score:.9,latencyClass:'fast'})],{consent:true});assert.equal(ranked[0].provider.id,'strong');assert.ok(ranked[0].score>ranked[1].score)});
test('router excludes cloud teacher without consent for sensitive data',async()=>{const ranked=await rankTeachers(pkg,[new P('cloud'),new P('local',{score:.4,privacyModes:['local']})],{consent:false});assert.deepEqual(ranked.map(x=>x.provider.id),['local'])});
test('orchestrator falls back after provider failure',async()=>{const r=await askTeacher({taskPackage:pkg,providers:[new P('first',{score:.95,fail:true}),new P('second',{score:.8})],consent:true,budget:{maxTeacherCalls:2,maxFallbacks:1,maxLatencyMs:30000}});assert.equal(r.status,'ok');assert.equal(r.providerId,'second');assert.equal(r.attempts.length,2)});
test('budget prevents unlimited fallback loops',async()=>{const r=await askTeacher({taskPackage:pkg,providers:[new P('a',{score:.9,fail:true}),new P('b',{score:.8,fail:true}),new P('c',{score:.7})],consent:true,budget:{maxTeacherCalls:2,maxFallbacks:1,maxLatencyMs:30000}});assert.notEqual(r.status,'ok');assert.ok(r.attempts.length<=2)});
test('provider config public snapshot never exposes secret reference',()=>{const c=new ProviderConfigStore([{id:'x',secretRef:'env:KEY'}]);const snap=c.publicSnapshot()[0];assert.equal(snap.hasSecret,true);assert.equal('secretRef' in snap,false)});
test('audit log excludes obvious secret fields',()=>{const a=new InMemoryTeacherAudit();const e=a.record('x',{providerId:'p',apiKey:'secret'});assert.equal(e.apiKey,undefined);assert.equal(e.providerId,'p')});

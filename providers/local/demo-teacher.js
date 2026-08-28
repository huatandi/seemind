import {TeacherProvider} from '../../core/teacher/teacher-provider.js';
export class DemoTeacherProvider extends TeacherProvider{
  constructor(){super('demo-local-teacher',{
    provider:'local',model:'demo',priority:-100,
    capabilities:[{capability:'reasoning',score:.25},{capability:'receipt_understanding',score:.5}],
    supportedLanguages:['auto','zh-CN','es-MX','en'],privacyModes:['local'],latencyClass:'fast',costClass:'free',
    reliabilityScore:.2,freshnessScore:.1,evidenceScore:.2,historicalSuccess:.2,
  });this.priority=-100}
  async healthCheck(){return {status:'ready'}}
  async estimate(){return {costClass:'free',latencyClass:'fast',estimatedCost:0,estimatedLatencyMs:10}}
  async execute(pkg){return {answer:`我收到的问题是：“${pkg.userIntent||pkg.task?.userIntent||''}”。这是本地开发老师，只用于验证 SeeMind 的 Teacher 链路，不代表真实 AI 推理结果。`,claims:[{id:'demo-claim',text:'这是开发演示响应，不是事实判断。',type:'unknown',status:'unknown',confidence:1,evidenceRefs:[]}],uncertainty:'demo_only',evidenceRefs:[],actions:[]}}
}

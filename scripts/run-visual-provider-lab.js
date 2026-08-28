import {VisualProvider} from '../core/vision/providers/visual-provider.js';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';
import {VisualProviderPerformanceStore} from '../core/vision/providers/visual-provider-performance.js';

class P extends VisualProvider{
 constructor(id,opts={}){super(id,opts);this.fail=opts.fail??false;this.value=opts.value??null}
 async analyze(_image,{capabilities}){if(this.fail)throw Object.assign(new Error('LAB_FAIL'),{code:'LAB_FAIL'});return {capability:capabilities[0],value:this.value??this.id}}
}
const store=new VisualProviderPerformanceStore();
const providers=[
 new P('fast-bad',{priority:100,capabilities:['object_identity'],estimatedLatencyMs:400,reliability:.9,fail:true}),
 new P('stable-id',{priority:70,capabilities:['object_identity'],estimatedLatencyMs:1200,reliability:.85,value:'device'}),
 new P('state',{priority:60,capabilities:['color_state'],estimatedLatencyMs:700,reliability:.9,value:'red'}),
];
const result=await executeVisualCapabilities({
 image:{id:'synthetic'},
 capabilities:['object_identity','color_state','anomaly_inspection'],
 providers,performanceStore:store,deviceClass:'balanced',deviceBudget:{maxMemoryMb:512}
});
const checks=[
 result.results.find(x=>x.capability==='object_identity')?.providerId==='stable-id',
 result.failures.some(x=>x.providerId==='fast-bad'),
 result.results.find(x=>x.capability==='color_state')?.providerId==='state',
 result.results.find(x=>x.capability==='anomaly_inspection')?.status==='unresolved',
 result.escalation.unresolvedCapabilities?.length===1&&result.escalation.unresolvedCapabilities[0]==='anomaly_inspection',
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Visual Student Provider Architecture Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),result,performance:store.snapshot()},null,2));
if(passed!==checks.length)process.exitCode=1;

import {routeVisualCapabilities} from '../core/vision/visual-capability-router.js';
import {buildVisualAnalysisPlan} from '../core/vision/visual-analysis-plan.js';
const cases=[
 ['receipt',{detectedType:'receipt',extractedText:'TOTAL 100 FECHA',observations:[{kind:'ocr',rawText:'TOTAL 100 FECHA'},{kind:'structured_facts',facts:[]}]},'这张小票多少钱？',x=>x.requested.some(y=>y.capability==='ocr_text')],
 ['unknown',{detectedType:'unknown',observations:[]},'这是什么？',x=>x.needsVisionTeacher&&x.missingCapabilities.includes('object_identity')],
 ['device-state',{detectedType:'device',observations:[]},'右边红灯一直闪，是不是坏了？',x=>x.requested.some(y=>y.capability==='color_state')&&x.requested.some(y=>y.capability==='anomaly_inspection')],
 ['parts',{detectedType:'device',observations:[]},'这两根线哪个接错了？',x=>x.requested.some(y=>y.capability==='component_parts')&&x.requested.some(y=>y.capability==='spatial_relationships')],
];
let passed=0,details=[];
for(const [id,o,q,check] of cases){const route=routeVisualCapabilities({observation:o,userQuestion:q});const ok=check(route);if(ok)passed++;details.push({id,ok,requested:route.requested.map(x=>`${x.capability}:${x.available?'local':'missing'}`)})}
const plan=buildVisualAnalysisPlan({observation:cases[1][1],userQuestion:cases[1][2]});
const planOk=plan.escalation.needed&&plan.escalation.sendPolicy==='minimum_necessary';if(planOk)passed++;
console.log(JSON.stringify({suite:'General Vision Student & Visual Capability Router Lab',checks:5,passed,failed:5-passed,score:Math.round(passed/5*100),details,unknownPlan:plan},null,2));
if(passed!==5)process.exitCode=1;

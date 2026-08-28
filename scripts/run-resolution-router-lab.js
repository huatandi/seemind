import {understandProblem} from '../core/resolution/problem-understanding.js';
import {planResolution,recommendHelpPath} from '../core/resolution/resolution-router.js';
const cases=[
 ['unknown-photo',{detectedType:'unknown',confidence:{overall:.3},limitations:[],localResolutionPossible:false,observations:[{kind:'structured_facts',facts:[]}]},{},x=>x.resolution.decision==='need_more_evidence'&&x.resolution.nextEvidence.length>=2],
 ['troubleshoot',{detectedType:'appliance',confidence:{overall:.7},limitations:['cause unknown'],localResolutionPossible:false,observations:[{kind:'structured_facts',facts:[]}]},{userQuestion:'机器坏了，怎么修？'},x=>x.problem.intentHypotheses[0].intent==='troubleshoot'&&x.resolution.decision==='teacher_or_tool'],
 ['local',{detectedType:'receipt',confidence:{overall:.9},limitations:[],localResolutionPossible:true,observations:[{kind:'structured_facts',facts:[{id:'money.total',name:'total',category:'money',value:10000,status:'resolved',confidence:.9,conflicts:[]}]}]},{userQuestion:'这是什么？'},x=>x.resolution.decision==='local_explain'],
 ['minimum-data',{detectedType:'device',confidence:{overall:.6},limitations:['need diagnosis'],localResolutionPossible:false,observations:[{kind:'structured_facts',facts:[]}]},{userQuestion:'怎么办？'},x=>x.resolution.escalation.sendPolicy==='minimum_necessary'&&!x.resolution.escalation.sendOriginalImage],
 ['help-path',{detectedType:'appliance',confidence:{overall:.5},limitations:['unknown failure'],localResolutionPossible:false,observations:[{kind:'structured_facts',facts:[]}]},{userQuestion:'坏了怎么修？'},x=>x.help.kind==='human_or_specialist_tool'],
];
let passed=0,failed=[];
for(const [id,o,c,check] of cases){const problem=understandProblem(o,c);const resolution=planResolution({observation:o,problem,context:c});const help=recommendHelpPath({problem,resolution,availableTeachers:[]});const x={problem,resolution,help};if(check(x))passed++;else failed.push({id,x})}
console.log(JSON.stringify({suite:'Problem Understanding & Resolution Router Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));if(failed.length)process.exitCode=1;

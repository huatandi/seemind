import {buildExplanationActionContract,renderExplanationActionText} from '../core/explanation/explanation-action-contract.js';
const input={
 observation:{confidence:{overall:.8},observations:[]},
 problem:{
  knownFacts:[{id:'identity.brand',name:'brand',value:'SAMSUNG',confidence:.95}],
  unknownFacts:[{id:'domain.model',name:'model'}],
  multimodalUnknowns:[{id:'reference.red_indicator',reason:'visual_grounding_required'}],
  intentHypotheses:[{intent:'troubleshoot',confidence:.9,reason:'explicit_problem_language'}],
  problemSignals:[],confidence:{observation:.8}
 },
 resolution:{
  decision:'need_more_evidence',canOfferSolutionNow:false,
  nextEvidence:[{kind:'capture_guidance',priority:1,instruction:'请拍清楚红灯附近的图标、文字和设备铭牌。',reason:'Need indicator meaning and model'}],
  escalation:{needed:true,preferredKinds:['vision','troubleshooting'],sendPolicy:'minimum_necessary',sendOriginalImage:true}
 },
 multimodal:{
  symptoms:[{type:'blinking_indicator',sourceText:'右边红灯一直闪',confidence:.9}],
  attemptedActions:[{type:'power_cycle',sourceText:'已经拔过一次插头',confidence:.9}],
  temporalContext:[{type:'yesterday_context',sourceText:'昨天还正常',confidence:.9}]
 },
 helpPath:{kind:'human_or_specialist_tool',message:'如果仍无法确认，请查官方说明书/诊断工具或让合格维修人员检查。'}
};
const c=buildExplanationActionContract(input),text=renderExplanationActionText(c);
const checks=[
 c.observed.items.some(x=>x.value==='SAMSUNG'),
 c.userReported.items.some(x=>x.text.includes('红灯')),
 c.assessment.items.every(x=>x.status!=='fact'),
 c.unknowns.items.some(x=>x.id==='domain.model'),
 c.actions.items.some(x=>x.instruction.includes('铭牌')),
 c.escalation.minimumNecessary===true,
 /我看到了什么/.test(text)&&/你告诉了我什么/.test(text)&&/我的判断/.test(text),
 /如果还不能解决/.test(text),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Explanation & Action Contract Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),preview:text},null,2));
if(passed!==checks.length)process.exitCode=1;

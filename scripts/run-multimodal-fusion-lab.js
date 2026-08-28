import {fuseMultimodalContext,buildMultimodalProblemPrompt} from '../core/multimodal/multimodal-fusion.js';

const visual={
  detectedType:'appliance',
  confidence:{overall:.78},
  limitations:['device model unresolved'],
  observations:[{kind:'structured_facts',facts:[
    {id:'identity.brand',category:'identity',name:'brand',value:'SAMSUNG',confidence:.95,status:'resolved',conflicts:[]},
    {id:'domain.model',category:'domain',name:'model',value:null,confidence:0,status:'unresolved',conflicts:[]},
  ]}]
};
const speech='这个昨天还正常，今天右边红灯一直闪，我已经拔过一次插头，还是不工作，怎么办？';
const ctx=fuseMultimodalContext({visualObservation:visual,speechText:speech,conversation:[{role:'user',text:'帮我看看这个',modality:'speech'}]});
const prompt=buildMultimodalProblemPrompt(ctx);
const checks=[
  ctx.modalities.image&&ctx.modalities.speech,
  ctx.symptoms.some(x=>x.type==='blinking_indicator'),
  ctx.symptoms.some(x=>x.type==='not_working'),
  ctx.attemptedActions.some(x=>x.type==='power_cycle'),
  ctx.temporalContext.some(x=>x.type==='yesterday_context'),
  ctx.references.some(x=>x.type==='right_side'&&x.requiresVisualGrounding),
  ctx.evidencePolicy.speechCannotCreateVisualFact,
  prompt.unknowns.length>0,
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Multimodal Input & Intent Fusion Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),context:ctx},null,2));
if(passed!==checks.length)process.exitCode=1;

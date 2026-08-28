import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

const ordinary={
  detectedType:'object',extractedText:'',confidence:{overall:.9},limitations:[],localResolutionPossible:false,
  observations:[
    {kind:'general_vision',providerId:'vision',identity:[{label:'car',confidence:.94,status:'observed'}],scene:[{label:'road_or_street',confidence:.72,status:'candidate'}],states:[],anomalies:[],regions:[],relationships:[],limitations:[]},
    {kind:'structured_facts',facts:[]},
    {kind:'visual_capability_plan',route:{missingCapabilities:[],needsVisionTeacher:false},providerExecution:{requiredCapabilities:[]}},
  ]
};
const withVoice=buildUniversalExplanation({observation:ordinary,speechText:'这个红灯一直闪，怎么办？'});
const firstLook=buildUniversalExplanation({observation:ordinary});
const checks=[
  firstLook.mode==='general_vision',
  /car/i.test(firstLook.summary),
  firstLook.nextSteps.some(x=>/直接对着图片说一句/.test(x)),
  withVoice.multimodal.modalities.speech===true,
  withVoice.voiceText.length>0&&withVoice.voiceText.length<500,
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({
  suite:'Universal Explain Experience Lab',
  checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),
  firstLook:{summary:firstLook.summary,highlights:firstLook.highlights,nextSteps:firstLook.nextSteps,voiceText:firstLook.voiceText},
  withVoice:{summary:withVoice.summary,highlights:withVoice.highlights,nextSteps:withVoice.nextSteps,decision:withVoice.resolution.decision}
},null,2));
if(passed!==checks.length)process.exitCode=1;

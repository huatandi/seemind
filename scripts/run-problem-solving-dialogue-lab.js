import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';
const o={detectedType:'object',extractedText:'E12',confidence:{overall:.85},limitations:[],localResolutionPossible:false,observations:[
 {kind:'general_vision',providerId:'vision',identity:[{label:'device',confidence:.92,status:'observed'}],scene:[],states:[{label:'red_indicator',confidence:.84,status:'observed'}],anomalies:[],regions:[],relationships:[],limitations:[]},
 {kind:'structured_facts',facts:[]},
 {kind:'visual_capability_plan',route:{missingCapabilities:[],needsVisionTeacher:false},providerExecution:{requiredCapabilities:[]}},
]};
const one=buildUniversalExplanation({observation:o,speechText:'这个红灯一直闪，怎么办？'});
const two=buildUniversalExplanation({observation:o,speechText:'我已经重启过了，还是一样',problemState:one.problemState});
const three=buildUniversalExplanation({observation:o,speechText:'现在好了，问题解决了',problemState:two.problemState});
const checks=[
 one.troubleshooting.nextStep!=null,
 two.problemState.attempts.some(x=>/重启/.test(x.text)),
 two.problemState.evidence.length>=one.problemState.evidence.length,
 three.problemState.status==='resolved',
 /问题解决/.test(three.nextSteps[0]),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Problem Solving Dialogue Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),turn1:{next:one.nextSteps,state:one.problemStateSummary},turn2:{next:two.nextSteps,state:two.problemStateSummary},turn3:{next:three.nextSteps,state:three.problemStateSummary}},null,2));
if(passed!==checks.length)process.exitCode=1;

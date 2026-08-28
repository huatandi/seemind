import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';
function obs(text,state=null){return {detectedType:'object',extractedText:text,confidence:{overall:.85},limitations:[],localResolutionPossible:false,observations:[
 {kind:'general_vision',providerId:'v',identity:[{label:'device',confidence:.92,status:'observed'}],scene:[],states:state?[{label:state,confidence:.85,status:'observed'}]:[],anomalies:[],regions:[{id:'r',regionType:'object',objectType:'device',confidence:.92,bbox:{x:.1,y:.1,width:.7,height:.7},tags:[]}],relationships:[],limitations:[]},
 {kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}
]}}
const one=buildUniversalExplanation({observation:obs('MODEL: MX-100'),textInput:'这是这台设备'});
const two=buildUniversalExplanation({observation:obs('ERROR E12','red_indicator'),textInput:'这是它的控制面板',problemState:one.problemState});
const three=buildUniversalExplanation({observation:obs('MODEL: ZX-900'),textInput:'这是另外一台机器',problemState:two.problemState});
const a=two.problemState.activeEntitySummary;
const checks=[
 two.problemState.evidenceGraph.photos.length===2,
 two.problemState.evidenceGraph.entities.length===1,
 a.model==='MX-100',
 a.errorCodes.includes('E12')&&a.states.includes('red_indicator'),
 three.problemState.lastPhotoRelationship.status==='likely_new_object'&&three.problemState.evidenceGraph.entities.length===2,
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Cross-Photo Evidence Reasoning Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),sameObject:two.problemState.lastPhotoRelationship,entity:a,newObject:three.problemState.lastPhotoRelationship,entityCountAfterNew:three.problemState.evidenceGraph.entities.length},null,2));
if(passed!==checks.length)process.exitCode=1;

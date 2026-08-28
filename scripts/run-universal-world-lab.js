import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';
function obs(label,text=''){return {detectedType:'object',extractedText:text,confidence:{overall:.85},limitations:[],localResolutionPossible:false,observations:[
 {kind:'general_vision',providerId:'v',identity:[{label,confidence:.92,status:'observed'}],scene:[],states:[],anomalies:[],regions:[],relationships:[],limitations:[]},
 {kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}
]}}
const cases=[
 ['plant','这株植物叶子有黄斑和虫怎么办？','叶片'],
 ['food','这个食品有什么成分，会过期吗？','配料'],
 ['insect','这是什么昆虫？','安全'],
 ['document','这份合同是什么意思？','整页'],
 ['car','这个汽车仪表图标是什么意思？','车辆'],
];
const results=cases.map(([label,q,expect])=>{const e=buildUniversalExplanation({observation:obs(label),textInput:q});return {label,q,domain:e.worldDomain.primary,next:e.evidenceRequest?.request?.instruction??e.nextSteps[0]??'',ok:(e.evidenceRequest?.request?.instruction??e.nextSteps.join(' ')).includes(expect)&&e.worldDomain.primary!=='repair'}});
const repair=buildUniversalExplanation({observation:obs('device','ERROR E12'),textInput:'机器报错 E12 怎么维修？'});
const checks=[...results.map(x=>x.ok),repair.worldDomain.primary==='repair'];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Universal World Understanding Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),results,repairSpecialist:{domain:repair.worldDomain.primary,next:repair.evidenceRequest?.request?.instruction}},null,2));
if(passed!==checks.length)process.exitCode=1;

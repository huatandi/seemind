import {understandUniversalIntent,planIntentResponse} from '../core/intent/universal-intent-router.js';
import {buildSpecialistHandoff} from '../core/intent/specialist-handoff.js';
const cases=[
 ['这是什么虫？有毒危险吗？我该怎么办？',['identify','safety','solve'],false],
 ['帮我翻译这里写的内容',['translate'],false],
 ['这个和刚才那个哪个好，有什么区别？',['compare'],false],
 ['哪里可以买到这个？给我链接',['find'],true],
 ['这个问题应该交给哪个AI？',['route_to_specialist'],true],
];
const results=cases.map(([q,expect,route])=>{const g=understandUniversalIntent({text:q,worldDomain:{primary:'general'}});const p=planIntentResponse({intentGraph:g,worldDomain:{primary:'general'}});const got=g.intents.map(x=>x.intent);return {q,got,route:p.shouldRouteExternally,ok:expect.every(x=>got.includes(x))&&p.shouldRouteExternally===route}});
const g=understandUniversalIntent({text:'这个植物交给哪个AI识别？',worldDomain:{primary:'plant'}});
const p=planIntentResponse({intentGraph:g,worldDomain:{primary:'plant'}});
const h=buildSpecialistHandoff({intentPlan:p,intentGraph:g,worldDomain:{primary:'plant'},problem:{userQuestion:g.userText,knownFacts:[{text:'叶片有黄斑'}]},observation:{},safety:{}});
results.push({q:'specialist handoff attribution',got:[h.category,h.seeMindRole,h.specialistRole],route:true,ok:h.attributionRequired&&h.seeMindRole==='orchestrator'&&h.evidencePackage.minimumNecessary});
const passed=results.filter(x=>x.ok).length;
console.log(JSON.stringify({suite:'Universal Intent + Orchestration Lab',checks:results.length,passed,failed:results.length-passed,score:Math.round(passed/results.length*100),results},null,2));
if(passed!==results.length)process.exitCode=1;

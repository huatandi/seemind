import {planKnowledgeRetrieval} from '../core/retrieval/knowledge-retrieval-router.js';
import {KnowledgeRetrievalCoordinator} from '../core/retrieval/knowledge-retrieval-coordinator.js';

const cases=[
 {name:'local',plan:planKnowledgeRetrieval({observation:{detectedType:'object',confidence:{overall:.92},limitations:[]},problem:{userQuestion:'这是什么？',problemSignals:[]},worldDomain:{primary:'general'},intentGraph:{intents:[{intent:'identify'}]},safetyRisk:{level:'R0'},localConfidence:.92,searchAvailable:true})},
 {name:'plant-search',plan:planKnowledgeRetrieval({observation:{detectedType:'object',confidence:{overall:.45},limitations:['uncertain']},problem:{userQuestion:'这是什么植物？',problemSignals:[]},worldDomain:{primary:'plant'},intentGraph:{intents:[{intent:'identify'}]},safetyRisk:{level:'R0'},localConfidence:.45,searchAvailable:true})},
 {name:'fresh-find',plan:planKnowledgeRetrieval({observation:{detectedType:'product',confidence:{overall:.9},limitations:[]},problem:{userQuestion:'现在哪里可以买？',problemSignals:[]},worldDomain:{primary:'product'},intentGraph:{intents:[{intent:'find'}]},safetyRisk:{level:'R0'},localConfidence:.9,searchAvailable:true})},
];
const c=new KnowledgeRetrievalCoordinator({searchFn:async()=>({results:[
 {title:'Official',url:'https://agency.gov/a',official:true,relevance:.96,freshnessScore:.9},
 {title:'University',url:'https://reference.edu/b',relevance:.9,freshnessScore:.8},
]})});
const retrieved=await c.run({plan:{shouldSearch:true,queries:['demo'],minimumSources:2,requireCrossCheck:true,needsImageSearch:false},intentGraph:{intents:[{intent:'identify'}]},safetyRisk:{level:'R0'},worldDomain:{primary:'general'}});
const checks=[
 cases[0].plan.localCanAnswer&&!cases[0].plan.shouldSearch,
 cases[1].plan.shouldSearch&&cases[1].plan.needsImageSearch,
 cases[2].plan.shouldSearch&&cases[2].plan.needsFreshness,
 retrieved.evaluation.canAnswer,
 retrieved.decision.decision==='retrieved_answer'&&retrieved.answerContract.answerPolicy.attributeSources,
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Knowledge Retrieval & Intelligent Escalation Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),cases,retrieved:{decision:retrieved.decision,evaluation:retrieved.evaluation,answerContract:retrieved.answerContract}},null,2));
if(passed!==checks.length)process.exitCode=1;

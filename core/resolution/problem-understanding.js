import {understandUniversalIntent} from '../intent/universal-intent-router.js';
export function understandProblem(observation={},context={}){
  const facts=findObservation(observation,'structured_facts');
  const specialized=findObservation(observation,'specialized_document');
  const detectedType=observation.detectedType??'unknown';
  const userQuestion=String(context.userQuestion??context.intent??'').trim();
  const multimodal=context.multimodalContext??findObservation(observation,'multimodal_context')??null;
  const multimodalFacts=multimodal?.visual?.facts??[];
  const combinedFacts=[...(facts?.facts??[]),...multimodalFacts.filter(f=>f.source==='general_vision')];
  const conflicts=combinedFacts.filter(f=>(f.conflicts??[]).length>0);
  const unresolved=combinedFacts.filter(f=>f.status==='unresolved'||f.value==null);
  const resolved=combinedFacts.filter(f=>(f.status==='resolved'||f.status==='observed')&&f.value!=null);
  const candidateFacts=combinedFacts.filter(f=>f.status==='candidate'&&f.value!=null);

  const canonicalIntent=understandUniversalIntent({text:userQuestion,observation,worldDomain:context.worldDomain??{}});
  const intentHypotheses=canonicalIntent.intents.length
    ? canonicalIntent.intents.map(x=>({intent:x.intent==='diagnose'?'troubleshoot':x.intent,confidence:x.confidence,reason:'universal_intent_router'}))
    : inferIntent({userQuestion,detectedType,specialized});
  const multimodalUnknowns=dedupeUnknowns(multimodal?.unknowns??[]);
  const problemSignals=[
    ...(conflicts.length?[{kind:'conflicting_evidence',severity:'medium',factIds:conflicts.map(x=>x.id)}]:[]),
    ...(observation.limitations?.length?[{kind:'insufficient_evidence',severity:'medium',details:observation.limitations}]:[]),
  ];

  return {
    schemaVersion:1,
    detectedType,
    userQuestion:userQuestion||null,
    intentHypotheses,
    knownFacts:resolved.map(compactFact),
    candidateFacts:candidateFacts.map(compactFact),
    unknownFacts:unresolved.map(f=>({id:f.id,name:f.name,category:f.category})),
    symptoms:[...(multimodal?.symptoms??[])],
    attemptedActions:[...(multimodal?.attemptedActions??[])],
    temporalContext:[...(multimodal?.temporalContext??[])],
    referencedObjects:[...(multimodal?.references??[])],
    multimodalUnknowns,
    problemSignals:[
      ...problemSignals,
      ...((multimodal?.contradictions??[]).map(x=>({kind:'cross_modal_conflict',severity:x.severity??'medium',details:x}))),
    ],
    understandingPolicy:{singleIntentAuthority:'UNIVERSAL_INTENT_ROUTER',singleUnknownAggregation:'PROBLEM_UNDERSTANDING'},
    confidence:{
      observation:Number(observation.confidence?.overall??0),
      intent:intentHypotheses[0]?.confidence??0,
    },
  };
}
function inferIntent({userQuestion,detectedType}){
  const q=userQuestion.toLowerCase(),out=[];
  if(/坏|故障|问题|修|不工作|error|falla|problema|repar/i.test(q))out.push({intent:'troubleshoot',confidence:.9,reason:'explicit_problem_language'});
  if(/是什么|这是什么|what is|qué es|que es/i.test(q))out.push({intent:'identify_and_explain',confidence:.92,reason:'explicit_identification_question'});
  if(/怎么办|怎么做|如何|how|cómo|como/i.test(q))out.push({intent:'solve_or_guide',confidence:.88,reason:'explicit_how_to_question'});
  if(/翻译|translate|traduc/i.test(q))out.push({intent:'translate',confidence:.95,reason:'explicit_translation_request'});
  if(!out.length&&detectedType!=='unknown')out.push({intent:'explain_observation',confidence:.68,reason:'recognized_input_default'});
  if(!out.length)out.push({intent:'identify_and_explain',confidence:.45,reason:'image_default'});
  return out.sort((a,b)=>b.confidence-a.confidence);
}
function dedupeUnknowns(items){const m=new Map();for(const x of items){const k=x?.id??`${x?.reason??'unknown'}:${x?.name??''}`;if(!m.has(k))m.set(k,x)}return [...m.values()]}
function compactFact(f){return {id:f.id,name:f.name,category:f.category,value:f.value,unit:f.unit,confidence:f.confidence,status:f.status,source:f.source??null,providerId:f.providerId??null}}
function findObservation(o,kind){return (o.observations??[]).find(x=>x.kind===kind)}

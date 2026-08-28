import {createTaskPackage} from '../task/task-package.js';
import {createStudentBriefing} from '../collaboration/student-briefing.js';
import {applyFreshnessToTask} from '../freshness/freshness-engine.js';
import {planSearch} from '../search/search-planner.js';
import {resolveEntities,identityGate} from '../entity/entity-resolver.js';
import {entityContextForTeacher} from '../entity/entity-context.js';
import {planTask,shouldPlanTask} from '../planning/planner.js';
import {planningContext} from '../planning/planning-context.js';
import {buildExactProductIdentity} from '../entity/exact-product-identity.js';
import {buildPrecisionEscalation} from '../collaboration/precision-escalation.js';

export function compileTaskPackage(input={}){
  const normalizedTask=applyFreshnessToTask(input.task??{});
  const base=createTaskPackage({...input,task:normalizedTask});
  const task=base.task??{};
  const collaboration=createStudentBriefing({observation:input.observation,receipt:input.receipt,userIntent:input.userIntent??base.userIntent});
  const entityResolution=resolveEntities({observation:input.observation,receipt:input.receipt,candidates:input.entityCandidates});
  const identity=identityGate(task,entityResolution);
  const identityBlock={...identity,context:entityContextForTeacher(entityResolution)};
  const exactProductIdentity=needsExactProductIdentity(task)?buildExactProductIdentity({barcodeObservation:findObservation(input.observation,'barcode_qr'),extractedText:input.observation?.extractedText,visionIdentities:[]}):null;
  const precisionEscalation=buildPrecisionEscalation({observation:input.observation,collaboration,problem:input.problemState??input.observation?.problem??{},answerability:input.answerability});
  const partial={...base,task,entities:entityResolution.primary?[entityResolution.primary]:[],entityResolution,identity:identityBlock,exactProductIdentity,precisionEscalation};
  const planned=shouldPlanTask(task)?planTask(task,{budget:{maxSteps:12,maxFailures:3,maxRetries:3,maxLatencyMs:30000}}):null;
  return {
    ...partial,
    schemaVersion:2,
    compiledAt:new Date().toISOString(),
    collaboration,
    problemState:input.problemState??null,
    answerability:input.answerability??null,
    planning:planned?planningContext(planned):null,
    search:planSearch(partial),
    contract:{
      id:base.outputSchema,
      version:1,
      requireUncertainty:true,
      requireClaims:task.type==='question_about_observation',
      requireEvidenceForFacts:true,
    },
    instructions:[
      'Use only the supplied context as observed evidence unless external evidence is explicitly available.',
      'Never convert uncertainty into fact.',
      'Every factual claim must declare evidenceRefs or be marked as inference/unknown.',
      'Do not propose an action that bypasses user confirmation.',
      'Use the Student collaboration brief to focus on unresolved or uncertain details instead of redoing reliable work.',
      'When precisionEscalation is present, solve only that residual gap; preserve reliable Student facts and return Teacher output as a candidate for verification.',
      'If freshness is required, do not answer time-sensitive claims from model memory; use supplied search evidence or state that current evidence is unavailable.',
      'Identity confidence is independent from OCR/fact confidence. Do not turn a candidate brand/model/entity into a confirmed identity.',
      'For identity-dependent tasks such as price, manual, compatibility or repair, verify identity first when the identity gate is not satisfied.',
      'When evidenceRetrieval requests more evidence, follow its source-type target and stop condition; do not repeat broad searches without a defined evidence gap.',
      'When planning is present, respect Task Graph dependency order, node stop conditions and budgets. Do not skip ahead or create an unbounded agent loop.',
    ],
  };
}

function needsExactProductIdentity(task={}){return /price_search|product_comparison|shopping|price|product/i.test(`${task.type??''} ${task.userIntent??''}`)}
function findObservation(o,type){return (o?.observations??[]).find(x=>x?.type===type)??null}

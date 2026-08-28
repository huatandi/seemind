/**
 * Immutable-style snapshot consumed by the Unified Orchestrator.
 * It preserves every specialist stage instead of collapsing them into one score.
 */
export function buildOrchestrationContext({
  task={},observation={},explanation={},capabilities={},taskPackage=null,
  executionHistory=[],retrievalResult=null,plannerState=null,teacherState=null,
  privacy=null,budget=null,verification=null,answerability=null,problemState=null,phase='ASSESS'
}={}){
  return {
    schemaVersion:1,
    phase,
    task,
    globalContext:taskPackage?.globalContext??task?.globalContext??null,
    perception:{
      detectedType:observation.detectedType??'unknown',
      confidence:Number(observation.confidence?.overall??0),
      limitations:[...(observation.limitations??[])],
      observationKinds:[...new Set((observation.observations??[]).map(x=>x.kind).filter(Boolean))],
    },
    understanding:{
      problemState:problemState??taskPackage?.problemState??null,
      answerability:answerability??taskPackage?.answerability??null,
      worldDomain:explanation.worldDomain??null,
      intentGraph:explanation.intentGraph??null,
      problem:explanation.problem??null,
    },
    evidence:{
      analysis:explanation.evidenceAnalysis??null,
      request:explanation.evidenceRequest??null,
      resolution:explanation.resolution??null,
      consensus:taskPackage?.evidenceConsensus??null,
      retrieval:taskPackage?.evidenceRetrieval??retrievalResult??null,
    },
    retrieval:{
      plan:explanation.retrievalPlan??null,
      runtime:retrievalResult??null,
      packageSearch:taskPackage?.search??null,
    },
    planning:{
      intentPlan:explanation.intentPlan??null,
      escalationPlan:explanation.escalationPlan??null,
      plannerState,
      taskGraph:taskPackage?.planning??null,
    },
    safety:explanation.safety??null,
    external:{
      teacherState,
      teacherCount:Number(capabilities.teacherCount??0),
      searchAvailable:Boolean(capabilities.searchAvailable),
      plannerAvailable:capabilities.plannerAvailable!==false,
    },
    privacy:privacy??taskPackage?.privacy??null,
    budget:budget??taskPackage?.budget??null,
    verification:verification??null,
    executionHistory:[...executionHistory],
  };
}

export function appendOrchestrationEvent(context,event={}){
  return {...context,executionHistory:[...(context.executionHistory??[]),{
    at:event.at??new Date().toISOString(),
    stage:event.stage??context.phase??'UNKNOWN',
    route:event.route??null,
    status:event.status??null,
    reason:event.reason??null,
    artifactRefs:[...(event.artifactRefs??[])],
  }]};
}

export function reentryContext(context,{phase='REASSESS',taskPackage=null,retrievalResult=null,plannerState=null,teacherState=null,verification=null,event=null}={}){
  let next={
    ...context,phase,
    globalContext:taskPackage?.globalContext??context.globalContext??null,
    evidence:{...context.evidence,
      consensus:taskPackage?.evidenceConsensus??context.evidence?.consensus??null,
      retrieval:taskPackage?.evidenceRetrieval??retrievalResult??context.evidence?.retrieval??null,
    },
    retrieval:{...context.retrieval,
      runtime:retrievalResult??context.retrieval?.runtime??null,
      packageSearch:taskPackage?.search??context.retrieval?.packageSearch??null,
    },
    planning:{...context.planning,plannerState:plannerState??context.planning?.plannerState??null,taskGraph:taskPackage?.planning??context.planning?.taskGraph??null},
    external:{...context.external,teacherState:teacherState??context.external?.teacherState??null},
    verification:verification?{verdict:verification,history:[...(context.verification?.history??[]),verification]}:context.verification??null,
  };
  return event?appendOrchestrationEvent(next,event):next;
}

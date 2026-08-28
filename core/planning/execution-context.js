export function createExecutionContext(input={}){
  return {
    taskPackage:input.taskPackage??null,
    observation:input.observation??null,
    receipt:input.receipt??null,
    conversation:[...(input.conversation??[])],
    entityCandidates:[...(input.entityCandidates??[])],
    verifiedEntity:input.verifiedEntity??null,
    evidence:[...(input.evidence??input.taskPackage?.evidence??[])],
    searchProvider:input.searchProvider??null,
    providers:[...(input.providers??[])],
    consent:Boolean(input.consent),
    privacyPolicy:{...(input.privacyPolicy??{})},
    audit:input.audit??null,
    performanceStore:input.performanceStore??null,
    result:null,
    evaluation:null,
    improvementCandidate:null,
    goalSatisfaction:null,
    warnings:[],
    trace:[],
    recovery:{restored:false,lastCheckpointAt:null},
  };
}

export function executionSnapshot(context={}){
  return {
    verifiedEntity:context.verifiedEntity??null,
    evidence:[...(context.evidence??[])],
    result:context.result??null,
    evaluation:context.evaluation??null,
    improvementCandidate:context.improvementCandidate??null,
    goalSatisfaction:context.goalSatisfaction??null,
    warnings:[...(context.warnings??[])],
    trace:[...(context.trace??[])],
    recovery:{...(context.recovery??{})},
  };
}

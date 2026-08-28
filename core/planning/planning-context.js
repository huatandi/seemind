export function planningContext(graph){
  return {
    schemaVersion:1,
    graphId:graph?.id??null,
    state:graph?.state??null,
    stopReason:graph?.stopReason??null,
    budget:graph?.budget?{...graph.budget}:null,
    counters:graph?.counters?{...graph.counters}:null,
    nodes:(graph?.nodes??[]).map(n=>({id:n.id,type:n.type,state:n.state,dependencies:[...n.dependencies],optional:Boolean(n.optional),retries:n.retries,maxRetries:n.maxRetries,stopCondition:n.stopCondition,escalationCondition:n.escalationCondition,metadata:{...n.metadata}})),
  };
}

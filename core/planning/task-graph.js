export const TASK_NODE_STATES=['pending','running','blocked','completed','failed','cancelled','skipped'];

export function createTaskNode(input={}){
  return {
    id:input.id??crypto.randomUUID(),
    type:input.type??'generic',
    dependencies:[...(input.dependencies??[])],
    state:input.state??'pending',
    input:input.input??null,
    output:input.output??null,
    evidence:[...(input.evidence??[])],
    retries:Number(input.retries??0),
    maxRetries:Math.max(0,Number(input.maxRetries??1)),
    optional:Boolean(input.optional),
    stopCondition:input.stopCondition??null,
    escalationCondition:input.escalationCondition??null,
    metadata:{...(input.metadata??{})},
    executionKey:input.executionKey??null,
  };
}

export function createTaskGraph({task,nodes=[],budget={},id}={}){
  const graph={
    schemaVersion:1,
    id:id??crypto.randomUUID(),
    taskId:task?.id??null,
    taskType:task?.type??'general_qa',
    state:'pending',
    nodes:nodes.map(createTaskNode),
    budget:{maxSteps:Math.max(1,Number(budget.maxSteps??12)),maxFailures:Math.max(0,Number(budget.maxFailures??3)),maxRetries:Math.max(0,Number(budget.maxRetries??3)),maxLatencyMs:Math.max(1000,Number(budget.maxLatencyMs??30000))},
    counters:{steps:0,failures:0,retries:0},
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
  };
  validateTaskGraph(graph);
  return graph;
}

export function validateTaskGraph(graph){
  const ids=new Set();
  for(const n of graph?.nodes??[]){if(ids.has(n.id))throw new Error(`DUPLICATE_TASK_NODE:${n.id}`);ids.add(n.id)}
  for(const n of graph?.nodes??[])for(const dep of n.dependencies)if(!ids.has(dep))throw new Error(`UNKNOWN_DEPENDENCY:${n.id}:${dep}`);
  const visiting=new Set(),visited=new Set(),byId=new Map((graph?.nodes??[]).map(n=>[n.id,n]));
  const visit=id=>{if(visiting.has(id))throw new Error('TASK_GRAPH_CYCLE');if(visited.has(id))return;visiting.add(id);for(const d of byId.get(id)?.dependencies??[])visit(d);visiting.delete(id);visited.add(id)};
  for(const id of ids)visit(id);
  return true;
}

export function readyNodes(graph){
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  return graph.nodes.filter(n=>n.state==='pending'&&n.dependencies.every(id=>byId.get(id)?.state==='completed'));
}

export function markNode(graph,nodeId,state,patch={}){
  if(!TASK_NODE_STATES.includes(state))throw new Error(`INVALID_TASK_NODE_STATE:${state}`);
  const n=graph.nodes.find(x=>x.id===nodeId);if(!n)throw new Error(`TASK_NODE_NOT_FOUND:${nodeId}`);
  Object.assign(n,patch,{state});graph.updatedAt=new Date().toISOString();return n;
}

export function graphSummary(graph){
  const counts={};for(const n of graph.nodes)counts[n.state]=(counts[n.state]??0)+1;
  return {id:graph.id,state:graph.state,total:graph.nodes.length,counts,counters:{...graph.counters}};
}

export function resumeBlockedNode(graph,nodeId,{output=null,retry=false}={}){
  const n=graph.nodes.find(x=>x.id===nodeId);if(!n)throw new Error(`TASK_NODE_NOT_FOUND:${nodeId}`);
  if(n.state!=='blocked')throw new Error(`TASK_NODE_NOT_BLOCKED:${nodeId}`);
  if(retry){n.state='pending';n.output=output;}
  else {n.state='completed';n.output=output;}
  graph.state='pending';graph.stopReason=null;graph.updatedAt=new Date().toISOString();return graph;
}

export function cancelTaskGraph(graph,reason='USER_CANCELLED'){
  for(const n of graph.nodes)if(['pending','blocked','running'].includes(n.state))n.state='cancelled';
  graph.state='cancelled';graph.stopReason=reason;graph.updatedAt=new Date().toISOString();return graph;
}

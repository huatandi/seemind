/**
 * Build a minimal recovery pass from Goal Satisfaction gaps.
 * This does not create a second planner: it re-opens only the existing graph
 * nodes that can close the reported gap, plus their downstream dependants.
 */
export function prepareGapDirectedRecovery(execution,{goalSatisfaction=null}={}){
  if(!execution?.graph||!execution?.context)throw new Error('INVALID_PLANNER_EXECUTION');
  const closure=goalSatisfaction??execution.context.goalSatisfaction;
  if(!closure||closure.status==='satisfied')return {changed:false,reason:'NO_OPEN_GOAL_GAP',reopened:[],preserved:completedIds(execution.graph)};
  if(closure.status==='blocked')return {changed:false,reason:'USER_OR_EVIDENCE_INPUT_REQUIRED',reopened:[],preserved:completedIds(execution.graph)};

  const seeds=seedNodes(execution.graph,closure.gaps??[]);
  if(!seeds.size)return {changed:false,reason:'NO_EXISTING_GRAPH_NODE_CAN_CLOSE_GAP',reopened:[],preserved:completedIds(execution.graph)};
  const reopen=withDescendants(execution.graph,seeds);
  const preserved=[];
  for(const node of execution.graph.nodes){
    if(!reopen.has(node.id)){if(node.state==='completed')preserved.push(node.id);continue;}
    node.state='pending';node.output=null;node.evidence=[];node.executionKey=null;node.retries=0;
    if(execution.nodeReceipts?.[node.id])delete execution.nodeReceipts[node.id];
  }
  execution.graph.state='pending';execution.graph.stopReason=null;execution.graph.updatedAt=new Date().toISOString();
  execution.context.result=null;
  execution.context.goalSatisfaction=null;
  execution.context.recovery={...(execution.context.recovery??{}),gapDirected:true,lastGoalGaps:[...(closure.gaps??[])],reopenedNodes:[...reopen]};
  execution.context.trace?.push?.(`graph:gap_recovery:${[...reopen].join(',')}`);
  return {changed:true,reason:'EXISTING_GRAPH_REOPENED_FOR_GOAL_GAPS',reopened:[...reopen],preserved};
}

function seedNodes(graph,gaps){
  const out=new Set();
  for(const gap of gaps){
    const matches=graph.nodes.filter(n=>matchesGap(n,gap));
    for(const n of matches)out.add(n.id);
  }
  return out;
}
function matchesGap(n,gap){
  const hay=`${n.id} ${n.type}`.toLowerCase();
  if(gap==='freshness_evidence_missing')return Boolean(n.metadata?.freshness)||/search_current|retrieve_evidence|search/.test(hay);
  if(gap==='requested_retrieval_not_completed')return /retrieve|search/.test(hay);
  if(gap==='identity_not_resolved')return /identify/.test(hay);
  if(gap==='requested_comparison_not_completed')return /compare/.test(hay);
  if(gap==='unresolved_evidence_or_conflict')return /verify|retrieve|search|consensus|synthesi/.test(hay);
  if(gap==='usable_final_result_missing')return /^final/.test(n.id)||/final_|recommendation|answer/.test(n.type);
  if(gap==='required_node_failed')return n.state==='failed'&&!n.optional;
  return false;
}
function withDescendants(graph,seeds){
  const out=new Set(seeds);let changed=true;
  while(changed){changed=false;for(const n of graph.nodes){if(out.has(n.id))continue;if(n.dependencies.some(d=>out.has(d))){out.add(n.id);changed=true}}}
  return out;
}
function completedIds(graph){return graph.nodes.filter(n=>n.state==='completed').map(n=>n.id)}

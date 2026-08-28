import {readyNodes,markNode,graphSummary,validateTaskGraph} from './task-graph.js';

export async function runTaskGraph(graph,{handlers={},context={},onEvent=null,onCheckpoint=null,receipts={},now=()=>Date.now()}={}){
  validateTaskGraph(graph);graph.state='running';const started=now();
  const emit=(type,data={})=>onEvent?.({type,graphId:graph.id,...data});
  const checkpoint=async(reason)=>{graph.updatedAt=new Date().toISOString();await onCheckpoint?.({reason,graph,context,receipts})};
  emit('graph_started',{summary:graphSummary(graph)});await checkpoint('graph_started');
  while(true){
    if(now()-started>graph.budget.maxLatencyMs)return stop(graph,'budget_exceeded','MAX_LATENCY',emit,checkpoint);
    if(graph.counters.steps>=graph.budget.maxSteps)return stop(graph,'budget_exceeded','MAX_STEPS',emit,checkpoint);
    if(graph.counters.failures>graph.budget.maxFailures)return stop(graph,'failed','MAX_FAILURES',emit,checkpoint);
    const ready=readyWithOptionalDeps(graph);
    if(!ready.length){
      if(graph.nodes.every(n=>['completed','skipped','cancelled'].includes(n.state)||(n.optional&&n.state==='failed'))){graph.state='completed';emit('graph_completed',{summary:graphSummary(graph)});await checkpoint('graph_completed');return {status:'completed',graph}}
      const blocking=graph.nodes.filter(n=>n.state==='failed'&&!n.optional);if(blocking.length)return stop(graph,'failed','BLOCKED_BY_FAILED_NODE',emit,checkpoint);
      return stop(graph,'blocked','NO_READY_NODES',emit,checkpoint);
    }
    const node=ready[0];
    const operation=operationFor(graph,node,receipts);
    if(operation.receipt?.status==='completed'){
      markNode(graph,node.id,'completed',{output:operation.receipt.output??null,evidence:[...(operation.receipt.evidence??[])]});
      emit('node_recovered',{nodeId:node.id,nodeType:node.type,idempotencyKey:operation.idempotencyKey});await checkpoint('node_recovered');continue;
    }
    graph.counters.steps++;markNode(graph,node.id,'running',{executionKey:operation.idempotencyKey});
    receipts[node.id]={...(receipts[node.id]??{}),idempotencyKey:operation.idempotencyKey,status:'running',startedAt:receipts[node.id]?.startedAt??new Date().toISOString(),attempt:node.retries+1};
    emit('node_started',{nodeId:node.id,nodeType:node.type,idempotencyKey:operation.idempotencyKey});await checkpoint('node_started');
    const handler=handlers[node.type]??handlers['*'];
    if(!handler){
      if(node.optional){markNode(graph,node.id,'skipped',{output:{reason:'NO_HANDLER'}});receipts[node.id]={...receipts[node.id],status:'skipped',completedAt:new Date().toISOString()};emit('node_skipped',{nodeId:node.id,reason:'NO_HANDLER'});await checkpoint('node_skipped');continue}
      markNode(graph,node.id,'failed',{output:{code:'NO_HANDLER'}});receipts[node.id]={...receipts[node.id],status:'failed',completedAt:new Date().toISOString(),error:'NO_HANDLER'};graph.counters.failures++;emit('node_failed',{nodeId:node.id,nodeType:node.type,code:'NO_HANDLER',error:'NO_HANDLER'});await checkpoint('node_failed');continue;
    }
    try{
      const result=await handler({node,graph,context,dependencyOutputs:dependencyOutputs(graph,node),operation:{idempotencyKey:operation.idempotencyKey,attempt:node.retries+1}});
      if(result?.status==='ask_user'){markNode(graph,node.id,'blocked',{output:result});receipts[node.id]={...receipts[node.id],status:'blocked',output:result,completedAt:new Date().toISOString()};graph.state='blocked';emit('graph_blocked',{nodeId:node.id,nodeType:node.type,reason:'ASK_USER',code:result.code??null});await checkpoint('graph_blocked');return {status:'ask_user',graph,node,result}}
      if(result?.status==='stop'){markNode(graph,node.id,'completed',{output:result});receipts[node.id]={...receipts[node.id],status:'completed',output:result,evidence:[...(result?.evidence??[])],completedAt:new Date().toISOString()};await checkpoint('node_completed');return stop(graph,'stopped',result.reason??'STOP_CONDITION',emit,checkpoint)}
      if(result?.status==='failed')throw new Error(result.code??'NODE_FAILED');
      const output=result?.output??result??null,evidence=[...(result?.evidence??[])];
      markNode(graph,node.id,'completed',{output,evidence});receipts[node.id]={...receipts[node.id],status:'completed',output,evidence,completedAt:new Date().toISOString()};emit('node_completed',{nodeId:node.id});await checkpoint('node_completed');
    }catch(error){
      if(node.retries<node.maxRetries && graph.counters.retries<graph.budget.maxRetries){node.retries++;graph.counters.retries++;markNode(graph,node.id,'pending',{output:{lastError:safeError(error)}});receipts[node.id]={...receipts[node.id],status:'retrying',error:safeError(error),retry:node.retries};emit('node_retry',{nodeId:node.id,nodeType:node.type,retry:node.retries,error:safeError(error)});await checkpoint('node_retry');continue}
      markNode(graph,node.id,'failed',{output:{error:safeError(error)}});receipts[node.id]={...receipts[node.id],status:'failed',error:safeError(error),completedAt:new Date().toISOString()};graph.counters.failures++;emit('node_failed',{nodeId:node.id,nodeType:node.type,error:safeError(error),code:safeError(error)});await checkpoint('node_failed');
      if(!node.optional)return stop(graph,'failed','NODE_FAILED',emit,checkpoint);
    }
  }
}

function operationFor(graph,node,receipts){const existing=receipts[node.id];return {idempotencyKey:existing?.idempotencyKey??`${graph.id}:${node.id}:attempt-${node.retries+1}`,receipt:existing}}
function readyWithOptionalDeps(graph){
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  return graph.nodes.filter(n=>n.state==='pending'&&n.dependencies.every(id=>{const d=byId.get(id);return d?.state==='completed'||(d?.optional&&['failed','skipped'].includes(d?.state))}));
}
function dependencyOutputs(graph,node){const byId=new Map(graph.nodes.map(n=>[n.id,n]));return Object.fromEntries(node.dependencies.map(id=>[id,byId.get(id)?.output]));}
async function stop(graph,state,reason,emit,checkpoint){graph.state=state;graph.stopReason=reason;graph.updatedAt=new Date().toISOString();emit('graph_stopped',{state,reason,summary:graphSummary(graph)});await checkpoint('graph_stopped');return {status:state,reason,graph};}
function safeError(e){return String(e?.message??e??'unknown_error').slice(0,300)}

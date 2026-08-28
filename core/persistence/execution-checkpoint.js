import {validateTaskGraph} from '../planning/task-graph.js';

export const EXECUTION_CHECKPOINT_VERSION=1;

export function createExecutionCheckpoint(execution,{reason='checkpoint',now=()=>new Date().toISOString()}={}){
  if(!execution?.graph||!execution?.context)throw new Error('INVALID_PLANNER_EXECUTION');
  validateTaskGraph(execution.graph);
  return {
    schemaVersion:EXECUTION_CHECKPOINT_VERSION,
    executionId:execution.id??execution.graph.id,
    graph:safeClone(execution.graph),
    context:serializableContext(execution.context),
    nodeReceipts:safeClone(execution.nodeReceipts??{}),
    createdAt:execution.createdAt??now(),
    checkpointedAt:now(),
    reason:String(reason).slice(0,120),
  };
}

export function restoreExecutionCheckpoint(checkpoint,{taskPackage=null,providers=[],searchProvider=null,privacyPolicy=null,consent=null,audit=null,performanceStore=null}={}){
  validateCheckpoint(checkpoint);
  const c=checkpoint.context??{};
  return {
    id:checkpoint.executionId??checkpoint.graph.id,
    schemaVersion:2,
    graph:safeClone(checkpoint.graph),
    context:{
      taskPackage:taskPackage??safeClone(c.taskPackage),
      observation:safeClone(c.observation),
      receipt:safeClone(c.receipt),
      conversation:safeClone(c.conversation??[]),
      entityCandidates:safeClone(c.entityCandidates??[]),
      verifiedEntity:safeClone(c.verifiedEntity),
      evidence:safeClone(c.evidence??[]),
      searchProvider,
      providers:[...providers],
      consent:consent==null?Boolean(c.consent):Boolean(consent),
      privacyPolicy:privacyPolicy?{...privacyPolicy}:{...(c.privacyPolicy??{})},
      audit,
      performanceStore,
      result:safeClone(c.result),
      warnings:safeClone(c.warnings??[]),
      trace:safeClone(c.trace??[]),
    },
    nodeReceipts:safeClone(checkpoint.nodeReceipts??{}),
    createdAt:checkpoint.createdAt??new Date().toISOString(),
    restoredAt:new Date().toISOString(),
  };
}

export function validateCheckpoint(checkpoint){
  if(!checkpoint||typeof checkpoint!=='object')throw new Error('INVALID_EXECUTION_CHECKPOINT');
  if(checkpoint.schemaVersion!==EXECUTION_CHECKPOINT_VERSION)throw new Error('UNSUPPORTED_EXECUTION_CHECKPOINT_VERSION');
  validateTaskGraph(checkpoint.graph);return true;
}

function serializableContext(context){
  return {
    taskPackage:safeTaskPackage(context.taskPackage),observation:safeClone(context.observation),receipt:safeClone(context.receipt),conversation:safeClone(context.conversation??[]),entityCandidates:safeClone(context.entityCandidates??[]),verifiedEntity:safeClone(context.verifiedEntity),evidence:safeClone(context.evidence??[]),consent:Boolean(context.consent),privacyPolicy:redactPrivacy(context.privacyPolicy),result:safeClone(context.result),warnings:safeClone(context.warnings??[]),trace:safeClone(context.trace??[]),
  };
}
function safeTaskPackage(pkg){if(!pkg)return pkg;const out=safeClone(pkg)??{};if(Array.isArray(out.media)&&out.media.length){out.media=[];out.recovery={...(out.recovery??{}),mediaOmitted:true}}return out}
function redactPrivacy(p={}){const out={};for(const [k,v] of Object.entries(p??{})){if(/key|secret|token|password|credential/i.test(k))continue;if(typeof v!=='function')out[k]=safeClone(v)}return out}
function safeClone(v){if(v==null)return v;try{return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}catch{return null}}

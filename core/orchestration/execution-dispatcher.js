import {createResultEnvelope} from './result-envelope.js';
import {reentryContext,appendOrchestrationEvent} from './orchestration-context.js';

const EXECUTABLE=new Set(['LOCAL','CLARIFY','SEARCH','PLAN','TEACHER','HUMAN','STOP']);

/**
 * The only runtime execution gateway after a RouteContract is issued.
 * It does not implement specialist logic; it invokes the registered specialist executor.
 */
export class ExecutionDispatcher{
  constructor({executors={},audit=null}={}){this.executors={...executors};this.audit=audit}
  register(route,executor){if(!EXECUTABLE.has(route))throw new Error(`UNKNOWN_ROUTE:${route}`);if(typeof executor!=='function')throw new Error('EXECUTOR_REQUIRED');this.executors[route]=executor;return this}
  async execute({contract,context,runtime={}}={}){
    validateContract(contract);
    const route=contract.route;
    const started=Date.now();
    this.audit?.record?.('orchestration_execution_started',{route,reason:contract.reason,phase:context?.phase});
    const executor=this.executors[route]??defaultExecutor(route);
    try{
      const raw=await executor({contract,context,runtime});
      const envelope=raw?.kind==='orchestration_result'?raw:createResultEnvelope({route,status:raw?.status??'completed',result:raw?.result??raw,artifacts:raw?.artifacts??[],taskPackage:raw?.taskPackage??null,reason:raw?.reason??contract.reason,metrics:{latencyMs:Date.now()-started},requiresVerification:contract.mustReenter});
      this.audit?.record?.('orchestration_execution_finished',{route,status:envelope.status,latencyMs:Date.now()-started});
      return envelope;
    }catch(error){
      const envelope=createResultEnvelope({route,status:'failed',reason:'executor_failed',error,metrics:{latencyMs:Date.now()-started},requiresVerification:true});
      this.audit?.record?.('orchestration_execution_failed',{route,error:envelope.error,latencyMs:Date.now()-started});
      return envelope;
    }
  }
}

export async function runOrchestrationLoop({initialContext,decide,dispatcher,verify=null,runtime={},maxTransitions=6,routeBudget=null,onTransition=null}={}){
  if(typeof decide!=='function')throw new Error('DECIDE_FUNCTION_REQUIRED');
  if(!dispatcher?.execute)throw new Error('DISPATCHER_REQUIRED');
  let context=initialContext;
  const transitions=[];
  for(let i=0;i<maxTransitions;i++){
    const contract=decide({context});
    onTransition?.({type:'decision',contract,context,index:i});
    const budgetCheck=checkRouteBudget(transitions,contract,routeBudget);
    if(!budgetCheck.allowed){
      context=appendOrchestrationEvent(context,{stage:'ORCHESTRATE',route:contract.route,status:'stopped',reason:budgetCheck.reason});
      return {status:'route_budget_exhausted',contract,context,transitions,reason:budgetCheck.reason,budget:budgetCheck};
    }
    const execution=await dispatcher.execute({contract,context,runtime});
    transitions.push({contract,execution});
    onTransition?.({type:'execution',contract,execution,context,index:i});
    if(contract.terminal||!contract.mustReenter)return {status:execution.status==='failed'?'failed':'completed',contract,execution,context,transitions};
    if(typeof verify!=='function')return {status:'verification_required',contract,execution,context,transitions,reason:'VERIFIER_REQUIRED'};
    const verification=await verify({envelope:execution,context,taskPackage:execution.taskPackage});
    onTransition?.({type:'verification',contract,execution,verification,context,index:i});
    context=reentryContext(context,{
      phase:`POST_VERIFY_${contract.route}`,
      taskPackage:execution.taskPackage,
      retrievalResult:contract.route==='SEARCH'?execution.result:null,
      plannerState:contract.route==='PLAN'?execution.result:null,
      teacherState:contract.route==='TEACHER'?execution.result:null,
      verification,
      event:{stage:'VERIFY',route:contract.route,status:verification?.status??'rejected',reason:verification?.reason??'verification_failed',artifactRefs:execution.artifacts?.map(x=>x.id??x.ref).filter(Boolean)??[]},
    });
    // Acceptance belongs to Verification Core; what to do with either acceptance
    // or rejection belongs to the Orchestrator on the next transition.

  }
  context=appendOrchestrationEvent(context,{stage:'ORCHESTRATE',status:'stopped',reason:'MAX_TRANSITIONS'});
  return {status:'max_transitions',context,transitions,reason:'MAX_TRANSITIONS'};
}

function validateContract(c){if(!c||c.authority!=='unified_orchestrator')throw new Error('UNAUTHORIZED_ROUTE_CONTRACT');if(!EXECUTABLE.has(c.route))throw new Error(`UNKNOWN_ROUTE:${c.route}`)}
function defaultExecutor(route){
 return async({contract})=>{
   if(route==='LOCAL')return createResultEnvelope({route,status:'completed',result:{action:'present_local_explanation'},reason:contract.reason,requiresVerification:false});
   if(route==='CLARIFY')return createResultEnvelope({route,status:'completed',result:{action:'collect_evidence',request:contract.details?.request??null},reason:contract.reason,requiresVerification:false});
   if(route==='HUMAN')return createResultEnvelope({route,status:'completed',result:{action:'present_human_referral',category:contract.details?.specialistCategory??null},reason:contract.reason,requiresVerification:false});
   if(route==='STOP')return createResultEnvelope({route,status:'completed',result:{action:'report_boundary'},reason:contract.reason,requiresVerification:false});
   throw new Error(`EXECUTOR_NOT_REGISTERED:${route}`);
 };
}

function checkRouteBudget(transitions,contract,budget){
 if(!budget)return {allowed:true,reason:'NO_ROUTE_BUDGET'};
 const external=new Set(['SEARCH','TEACHER','PLAN']);
 if(!external.has(contract?.route))return {allowed:true,reason:'TERMINAL_OR_LOCAL_ROUTE'};
 const prior=transitions.map(x=>x.contract).filter(c=>external.has(c?.route));
 const maxExternal=Number(budget.maxExternalCalls??Infinity);
 if(prior.length>=maxExternal)return {allowed:false,reason:'MAX_EXTERNAL_CALLS',used:prior.length,max:maxExternal};
 const same=prior.filter(c=>c.route===contract.route);
 const maxSame=Number(budget.maxSameRoute??Infinity);
 if(same.length>=maxSame)return {allowed:false,reason:`MAX_${contract.route}_CALLS`,used:same.length,max:maxSame};
 return {allowed:true,reason:'WITHIN_ROUTE_BUDGET',used:prior.length,max:maxExternal};
}

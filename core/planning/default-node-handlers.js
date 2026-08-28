import {askTeacher} from '../teacher/teacher-orchestrator.js';
import {buildIdentityVerificationPackage,verifiedEntityCandidate} from '../entity/entity-verification.js';
import {compileTaskPackage} from '../compiler/task-package-compiler.js';
import {planSearch} from '../search/search-planner.js';
import {searchResultsToEvidence} from '../search/search-evidence.js';
import {analyzeConsensus} from '../evidence/evidence-consensus.js';
import {planEvidenceRetrieval,buildEscalatedSearchPlan} from '../search/evidence-retrieval-strategy.js';

export function createDefaultNodeHandlers(){
  const teacher=teacherHandler;
  return {
    identify_entity:identityHandler,
    retrieve_primary_manual:searchHandler,
    retrieve_specifications:searchHandler,
    search_current_prices:searchHandler,
    retrieve_evidence:searchHandler,
    verify_diagnosis:evidenceVerificationHandler,
    generate_diagnosis:teacher,
    recommend_solution:teacher,
    identify_parts:teacher,
    compare_options:teacher,
    synthesize_evidence:teacher,
    final_recommendation:finalTeacherHandler,
    explain_manual:finalTeacherHandler,
    final_answer:finalTeacherHandler,
    resolve_task:finalTeacherHandler,
    capability_step:teacher,
    clarify_research_scope:clarifyHandler,
  };
}

async function identityHandler({context,operation}){
  let pkg=currentPackage(context);context.audit?.record?.('identity_resolution_started',{taskId:pkg?.task?.id});
  if(pkg?.identity?.ok){context.verifiedEntity=pkg.entityResolution?.primary??pkg.entities?.[0]??context.verifiedEntity;context.trace.push('node:identity:already_verified');return {output:context.verifiedEntity,evidence:evidenceOf(pkg)}}
  if(!context.providers.length)return {status:'ask_user',question:'我还不能可靠确认它的准确身份或型号。请补充更清楚的照片、型号标签或型号文字。',code:'IDENTITY_NEEDS_INPUT'};
  const verification=buildIdentityVerificationPackage(pkg);
  const response=await askTeacher({taskPackage:withOperation(verification,operation),providers:context.providers,consent:context.consent,privacyPolicy:context.privacyPolicy,audit:context.audit,performanceStore:context.performanceStore});
  if(response.status==='blocked')return {status:'ask_user',question:'需要你的允许后，我才能把最小必要图片交给老师确认型号。',code:'CONSENT_REQUIRED'};
  if(response.status!=='ok'||!response.result?.identityProposal)return {status:'ask_user',question:'目前仍无法可靠确认准确身份。请补充型号标签或更清晰照片。',code:'IDENTITY_UNRESOLVED'};
  context.verifiedEntity=verifiedEntityCandidate(response.result.identityProposal);context.audit?.record?.('identity_verified',{taskId:pkg?.task?.id,canonicalName:context.verifiedEntity?.canonicalName,category:context.verifiedEntity?.category,confidence:context.verifiedEntity?.confidence,evidenceRefs:context.verifiedEntity?.evidenceRefs??[]});
  context.taskPackage=recompile(context,[...context.entityCandidates,context.verifiedEntity]);
  context.evidence=mergeEvidence(context.evidence,evidenceOf(context.taskPackage));
  context.trace.push(`node:identity:${context.verifiedEntity?.canonicalName??'verified'}`);
  return {output:context.verifiedEntity,evidence:context.evidence};
}

async function searchHandler({node,context,operation}){
  if(!context.searchProvider){context.audit?.record?.('search_failed',{taskId:context.taskPackage?.task?.id,nodeType:node.type,code:'SEARCH_UNAVAILABLE'});throw new Error('SEARCH_UNAVAILABLE')}
  const pkg=currentPackage(context);let plan=searchPlanForNode(pkg,node,context);context.audit?.record?.('search_planned',{taskId:pkg?.task?.id,nodeType:node.type,queryFingerprint:fingerprint(plan.query),freshnessClass:plan.freshnessClass,evidenceTarget:plan.evidenceTarget});
  if(plan.blocked)return {status:'ask_user',question:'搜索前需要先确认准确的品牌或型号。',code:'SEARCH_BLOCKED_BY_IDENTITY'};
  const maxSearches=Math.max(1,Number(pkg?.budget?.maxSearches??3));let searches=0;let consensus=null;let retrieval=null;let added=[];
  while(searches<maxSearches){
    searches++;
    let searched;
    try{searched=await context.searchProvider.search({...plan,requestId:operation?.idempotencyKey??plan.requestId})}
    catch(error){context.audit?.record?.('search_failed',{taskId:pkg?.task?.id,nodeType:node.type,attempt:searches,queryFingerprint:fingerprint(plan.query),code:String(error?.message??error).slice(0,160)});throw error}
    const ev=searched.evidence??searchResultsToEvidence(searched.results??[],{requestId:searched.requestId??crypto.randomUUID(),freshnessClass:plan.freshnessClass,task:pkg.task});
    added=mergeEvidence(added,ev);context.evidence=mergeEvidence(context.evidence,ev);context.audit?.record?.('search_completed',{taskId:pkg?.task?.id,nodeType:node.type,attempt:searches,queryFingerprint:fingerprint(plan.query),evidenceCount:ev.length,sourceCount:new Set(ev.map(e=>e.sourceGroup??e.canonicalSource??e.publisher??e.url).filter(Boolean)).size});
    consensus=analyzeConsensus(context.evidence.filter(e=>e?.type==='search'),pkg.task??{});
    retrieval=planEvidenceRetrieval({task:{...(pkg.task??{}),identityConfidence:pkg.identity?.confidence??pkg.entityResolution?.primary?.confidence},search:plan,consensus,evidence:context.evidence.filter(e=>e?.type==='search'),attempt:searches,maxSearches});
    context.trace.push(`node:search:${node.type}:${searches}:${retrieval.action}`);
    if(retrieval.action!=='search_more')break;
    const next=buildEscalatedSearchPlan(plan,retrieval,searches+1);if(!next)break;context.audit?.record?.('search_escalated',{taskId:pkg?.task?.id,nodeType:node.type,attempt:searches+1,action:retrieval.action,reason:retrieval.reason,queryFingerprint:fingerprint(next.query)});plan=next;
  }
  const output={query:plan.query,searchesUsed:searches,evidenceCount:added.length,consensus,retrieval};
  if(retrieval?.action==='report'&&consensus?.status==='conflicted')context.warnings.push('SOURCE_CONFLICT_UNRESOLVED');
  return {output,evidence:added};
}

async function evidenceVerificationHandler({context,dependencyOutputs}){
  const pkg=packageWithExecutionEvidence(context);
  const consensus=analyzeConsensus(context.evidence.filter(e=>e?.type==='search'),pkg.task??{});
  context.trace.push(`node:evidence:${consensus?.status??'none'}`);context.audit?.record?.('evidence_consensus',{taskId:pkg?.task?.id,status:consensus?.status??'none',resolutionStatus:consensus?.resolution?.status??null,recommendation:consensus?.recommendation??null,independentSources:consensus?.independentSourceCount??null});
  if(consensus?.status==='conflicted'&&consensus?.resolution?.status!=='resolved'){
    return {status:'ask_user',question:'可靠来源之间仍有冲突。我可以继续查证，或先把分歧明确告诉你。',code:'EVIDENCE_CONFLICT',output:{consensus,dependencyOutputs}};
  }
  return {output:{consensus,verified:true,dependencyOutputs},evidence:context.evidence};
}

async function teacherHandler({node,context,dependencyOutputs,operation}){
  if(!context.providers.length)throw new Error('NO_TEACHER');
  const pkg=withOperation(packageForNode(context,node,dependencyOutputs),operation);
  const response=await askTeacher({taskPackage:pkg,providers:context.providers,consent:context.consent,privacyPolicy:context.privacyPolicy,audit:context.audit,performanceStore:context.performanceStore});
  if(response.status==='blocked')return {status:'ask_user',question:'这一步需要你的允许后才能把最小必要内容交给老师。',code:'CONSENT_REQUIRED'};
  if(response.status!=='ok')throw new Error(response.code??'TEACHER_FAILED');
  context.trace.push(`node:teacher:${node.type}:${response.providerId??'teacher'}`);
  return {output:response.result,evidence:response.result?.evidence??[]};
}

async function finalTeacherHandler(args){
  const result=await teacherHandler(args);
  if(result?.output){args.context.result=result.output;args.context.trace.push(`node:result:${args.node.type}`)}
  return result;
}

async function clarifyHandler({context}){
  const intent=String(context.taskPackage?.userIntent??context.taskPackage?.task?.userIntent??'').trim();
  if(!intent)return {status:'ask_user',question:'你希望我重点研究什么？',code:'RESEARCH_SCOPE_REQUIRED'};
  return {output:{scope:intent}};
}

function currentPackage(context){return packageWithExecutionEvidence(context)}
function packageWithExecutionEvidence(context){return {...context.taskPackage,evidence:mergeEvidence(context.taskPackage?.evidence??[],context.evidence??[]),entities:context.verifiedEntity?[context.verifiedEntity]:(context.taskPackage?.entities??[])} }
function packageForNode(context,node,dependencyOutputs){
  const base=packageWithExecutionEvidence(context);
  return {...base,executionNode:{id:node.id,type:node.type,goal:node.metadata?.goal??node.type,dependencies:[...node.dependencies],dependencyOutputs},instructions:[...(base.instructions??[]),`Execute only Task Graph node: ${node.type}. Do not perform later nodes. Return evidence-backed structured output for this node.`]};
}
function searchPlanForNode(pkg,node,context){
  const task={...(pkg.task??{}),webSearchRequired:true,realtimeRequired:node.metadata?.freshness==='FAST_CHANGING'||pkg.task?.realtimeRequired};
  const p=planSearch({...pkg,task,entityResolution:context.verifiedEntity?{...(pkg.entityResolution??{}),primary:context.verifiedEntity}:pkg.entityResolution,entities:context.verifiedEntity?[context.verifiedEntity]:pkg.entities});
  const target=node.metadata?.evidenceTarget??node.type;
  return {...p,required:true,query:buildNodeQuery(p.query??pkg.userIntent,node,context.verifiedEntity),evidenceTarget:target,taskContext:{...(p.taskContext??{}),nodeType:node.type,evidenceTarget:target}};
}
function buildNodeQuery(base,node,entity){
  const ident=[entity?.brand,entity?.model,entity?.variant,entity?.canonicalName].filter(Boolean).join(' ');
  const suffix={retrieve_primary_manual:'official manual service manual',retrieve_specifications:'official specifications',search_current_prices:'current price availability',retrieve_evidence:'authoritative evidence'}[node.type]??node.type;
  return [ident,base,suffix].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}
function recompile(context,candidates){
  const old=context.taskPackage??{};
  let pkg=compileTaskPackage({task:old.task,observation:context.observation,receipt:context.receipt,userIntent:old.userIntent,conversation:context.conversation,entityCandidates:candidates});
  if(old.media?.length)pkg={...pkg,media:old.media};return pkg;
}
function evidenceOf(pkg){return [...(pkg?.evidence??[])]}
function mergeEvidence(a=[],b=[]){const m=new Map();for(const e of [...a,...b]){if(!e)continue;const k=e.id??`${e.type??'e'}:${e.url??''}:${e.claimKey??''}:${String(e.claimValue??'')}`;m.set(k,e)}return [...m.values()]}

function withOperation(pkg,operation){return operation?.idempotencyKey?{...pkg,execution:{...(pkg.execution??{}),idempotencyKey:operation.idempotencyKey,attempt:operation.attempt??1}}:pkg}

function fingerprint(text=''){let h=2166136261;const s=String(text);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

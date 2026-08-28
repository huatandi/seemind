import {askTeacher} from '../../../../core/teacher/teacher-orchestrator.js';
import {withVisionAttachments} from '../../../../core/vision/vision-attachment.js';
import {prepareGroundedTask} from '../../../../core/workflow/identity-search-verify.js';
import {createPlannerExecution,executePlannerExecution} from '../../../../core/planning/planner-execution-orchestrator.js';
import {analyzeConsensus} from '../../../../core/evidence/evidence-consensus.js';
import {prepareExternalSearchRequest} from '../../../../core/privacy/external-query-policy.js';
import {createDefaultSearchCapabilityRegistry,executeSearchCapabilitySelection} from '../../../../core/retrieval/search-capability-registry.js';
import {routeIntelligenceGap} from '../../../../core/orchestration/intelligence-gap-router.js';

export function createWebCapabilityExecutors({
 getTaskPackage,setTaskPackage,getObservation,getVisionAttachment,getConversation,getProviders,getSearchProvider,getSearchCapabilities=null,
 getVerifiedEntity,setVerifiedEntity,getPendingExecution,setPendingExecution,taskStateStore,auditLog,
 requestConsent=async()=>false,onPlannerEvent=()=>{},searchPrivacyPolicy={}
}={}){
 const teacher=async()=>{
   const currentPackage=getTaskPackage?.();if(!currentPackage)return {status:'failed',reason:'NO_TASK_PACKAGE'};
   let providers=getProviders?.()??[];if(!providers.length)return {status:'failed',reason:'NO_TEACHER'};
   const requestedCaps=(currentPackage.task?.requiredCapabilities??[]).filter(Boolean);
   if(requestedCaps.length){
     const routed=await routeIntelligenceGap({
       gap:{kind:currentPackage.task?.type??'teacher',requiredCapabilities:requestedCaps},
       taskPackage:currentPackage,providers,requestKey:currentPackage.execution?.idempotencyKey??currentPackage.task?.id??''
     });
     if(routed.status==='ready')providers=routed.chain.map(x=>x.provider);
   }
   const currentVisionAttachment=getVisionAttachment?.();
   const consent=await requestConsent({kind:'teacher',message:'需要把完成这个问题所必需的最少内容交给老师。是否允许这一次？'});
   if(!consent)return {status:'failed',reason:'CONSENT_DENIED'};
   let teacherPackage=currentVisionAttachment?withVisionAttachments(currentPackage,[currentVisionAttachment]):currentPackage;
   const observation=getObservation?.();
   const receipt=observation?.observations?.find(x=>x.kind==='receipt_fields')?.receipt;
   // TEACHER may resolve identity with Teacher, but may not silently run Search.
   const prepared=await prepareGroundedTask({
     taskPackage:teacherPackage,observation,receipt,conversation:getConversation?.()??[],providers,
     searchProvider:null,consent,privacyPolicy:{allowImages:Boolean(currentVisionAttachment),allowRawText:false},
     entityCandidates:[getVerifiedEntity?.()].filter(Boolean),audit:auditLog
   });
   const pkg=prepared.package??teacherPackage;setTaskPackage?.(pkg);
   if(prepared.verifiedEntity)setVerifiedEntity?.(prepared.verifiedEntity);
   if(['identity_unresolved','needs_identity_teacher'].includes(prepared.status))return {status:'failed',taskPackage:pkg,reason:prepared.status};
   const response=await askTeacher({taskPackage:pkg,providers,consent,privacyPolicy:{allowImages:Boolean(currentVisionAttachment),allowRawText:false},audit:auditLog});
   if(response.status!=='ok')return {status:'failed',taskPackage:pkg,reason:response.code??response.status,result:response};
   return {status:'completed',taskPackage:pkg,reason:'teacher_completed',result:{answer:response.result,providerId:response.providerId,router:response.router,budget:response.budget}};
 };

 const search=async({contract}={})=>{
   const currentPackage=getTaskPackage?.();if(!currentPackage)return {status:'failed',reason:'NO_TASK_PACKAGE'};
   const observation=getObservation?.();const currentVisionAttachment=getVisionAttachment?.();
   const receipt=observation?.observations?.find(x=>x.kind==='receipt_fields')?.receipt;
   let pkg=currentVisionAttachment?withVisionAttachments(currentPackage,[currentVisionAttachment]):currentPackage;
   const rawSearchProvider=getSearchProvider?.()??null;
   const capabilityProviders=getSearchCapabilities?.()??{};
   if(!rawSearchProvider&&!Object.values(capabilityProviders).some(Boolean))return {status:'failed',taskPackage:pkg,reason:'SEARCH_UNAVAILABLE'};
   const worldDomain={primary:pkg.worldDomain?.primary??pkg.task?.domain??pkg.task?.worldDomain??'general'};
   const globalContext=pkg.globalContext??{
     userRegion:pkg.task?.userRegion??null,questionRegion:pkg.task?.questionRegion??null,objectRegion:pkg.task?.objectRegion??null,
     jurisdiction:pkg.task?.jurisdiction??null,language:pkg.task?.language??null,locale:pkg.task?.locale??null,currency:pkg.task?.currency??null,timezone:pkg.task?.timezone??null
   };
   const registry=createDefaultSearchCapabilityRegistry({webProvider:rawSearchProvider,...capabilityProviders});
   const retrievalPlan=contract?.details?.retrievalPlan??pkg.retrievalPlan??{
     preferredSources:contract?.details?.preferredSources??['reputable_web'],
     needsFreshness:Boolean(contract?.details?.needsFreshness),
     needsAuthority:Boolean(contract?.details?.needsAuthority),
     needsImageSearch:Boolean(contract?.details?.needsImageSearch),
   };
   const selection=registry.select({plan:retrievalPlan,task:pkg.task??{},worldDomain,intentGraph:pkg.intentGraph??{},globalContext});
   if(!selection.primary)return {status:'failed',taskPackage:pkg,reason:'NO_SEARCH_CAPABILITY',result:{selection}};
   const searchProvider=createCapabilityRoutedSearchProvider({registry,selection,task:pkg.task??{},worldDomain,globalContext,observation,policy:searchPrivacyPolicy,auditLog});

   // If the compiled package already has a grounded search workflow, preserve it.
   if(pkg.search?.required){
     const prepared=await prepareGroundedTask({
       taskPackage:pkg,observation,receipt,conversation:getConversation?.()??[],providers:[],
       searchProvider,consent:false,privacyPolicy:{allowImages:false,allowRawText:false},
       entityCandidates:[getVerifiedEntity?.()].filter(Boolean),audit:auditLog
     });
     const next=prepared.package??pkg;setTaskPackage?.(next);
     if(prepared.verifiedEntity)setVerifiedEntity?.(prepared.verifiedEntity);
     if(prepared.status==='ready')return {status:'completed',taskPackage:next,result:{search:next.search??null,evidenceConsensus:next.evidenceConsensus??null,evidence:next.evidence??[]},reason:'retrieval_completed'};
     if(['needs_identity_teacher','identity_unresolved'].includes(prepared.status))return {status:'completed',taskPackage:next,result:{status:prepared.status,evidence:next.evidence??[]},reason:'identity_needed_before_search'};
     return {status:'failed',taskPackage:next,result:{status:prepared.status},reason:prepared.status??'search_failed'};
   }

   // RetrievalPlan-driven SEARCH: execute the Orchestrator-approved queries directly.
   const queries=[...(contract?.details?.queries??[])].filter(Boolean).slice(0,3);
   if(!queries.length)return {status:'failed',taskPackage:pkg,reason:'SEARCH_QUERY_MISSING'};
   let evidence=[...(pkg.evidence??[])];
   let used=0;
   for(const query of queries){
     used+=1;
     const searched=await searchProvider.search({
       query,
       maxResults:5,
       freshnessClass:pkg.freshness?.freshnessClass??'SLOW_CHANGING',
       maxAgeMs:pkg.freshness?.maxAgeMs??null,
       taskContext:{type:pkg.task?.type??null,userIntent:pkg.task?.userIntent??pkg.userIntent??''},
     });
     evidence=mergeEvidence(evidence,searched.evidence??[]);
   }
   const searchEvidence=evidence.filter(e=>e?.type==='search');
   const evidenceConsensus=analyzeConsensus(searchEvidence,pkg.task??{});
   pkg={...pkg,evidence,evidenceConsensus,search:{
     ...(pkg.search??{}),required:true,status:'completed',resultCount:searchEvidence.length,searchesUsed:used,
     consensusRecommendation:evidenceConsensus.recommendation??null,source:'retrieval_plan',
     privacy:{sendPolicy:'minimum_necessary',rawOcrIncluded:false},
     capabilitySelection:selection
   }};
   setTaskPackage?.(pkg);
   return {status:'completed',taskPackage:pkg,result:{search:pkg.search,evidenceConsensus,evidence:searchEvidence},reason:'retrieval_plan_completed'};
 };

 const plan=async()=>{
   const currentPackage=getTaskPackage?.();if(!currentPackage)return {status:'failed',reason:'NO_TASK_PACKAGE'};
   const consent=await requestConsent({kind:'plan',message:'这个问题需要分步处理，可能调用必要的搜索或老师能力。是否允许这一次执行该计划？'});
   if(!consent)return {status:'failed',reason:'CONSENT_DENIED'};
   const providers=getProviders?.()??[];const searchProvider=getSearchProvider?.()??null;
   const observation=getObservation?.();const vision=getVisionAttachment?.();
   const receipt=observation?.observations?.find(x=>x.kind==='receipt_fields')?.receipt;
   const taskPackage=vision?withVisionAttachments(currentPackage,[vision]):currentPackage;
   let execution=getPendingExecution?.();
   if(execution){
     execution.context.providers=[...providers];execution.context.searchProvider=searchProvider;execution.context.consent=consent;
     execution.context.privacyPolicy={allowImages:Boolean(vision),allowRawText:false};
   }else execution=createPlannerExecution({
     taskPackage,observation,receipt,conversation:getConversation?.()??[],providers,searchProvider,consent,
     privacyPolicy:{allowImages:Boolean(vision),allowRawText:false},entityCandidates:[getVerifiedEntity?.()].filter(Boolean),audit:auditLog
   });
   setPendingExecution?.(execution);
   const executed=await executePlannerExecution(execution,{stateStore:taskStateStore,onEvent:onPlannerEvent});
   if(execution.context.verifiedEntity)setVerifiedEntity?.(execution.context.verifiedEntity);
   if(executed.status==='completed')setPendingExecution?.(null);
   return {
     status:executed.status==='completed'||executed.status==='ask_user'?'completed':'failed',
     taskPackage:execution.context.taskPackage??currentPackage,
     reason:executed.reason??executed.status,
     result:{planner:executed,resultValue:executed.resultValue??null,question:executed.result?.question??null,warnings:execution.context.warnings??[]},
   };
 };

 return {SEARCH:search,TEACHER:teacher,PLAN:plan};
}
function mergeEvidence(existing=[],incoming=[]){
 const m=new Map();for(const e of [...existing,...incoming]){if(!e)continue;const k=e.id??`${e.type??'e'}:${e.url??''}:${e.claimKey??''}:${String(e.claimValue??'')}`;m.set(k,e)}return [...m.values()];
}



function createCapabilityRoutedSearchProvider({registry,selection,task={},worldDomain={},globalContext={},observation={},policy={},auditLog=null}={}){
 return {
   async search(plan={}){
     const prepared=prepareExternalSearchRequest({
       queries:[String(plan.query??'')],task,worldDomain,observation,policy,consent:false,
     });
     auditLog?.record?.('search_privacy_gate',{
       allowed:prepared.allowed,reason:prepared.reason,requiresConsent:prepared.privacy?.requiresConsent??false,
       originalFingerprint:prepared.privacy?.assessments?.[0]?.originalFingerprint??null,
       redactionCount:prepared.privacy?.assessments?.[0]?.sanitized?.redactions?.length??0,
       capability:selection?.primary?.type??null,
     });
     if(!prepared.allowed)throw new Error(prepared.reason||'SEARCH_PRIVACY_BLOCKED');
     const safeQuery=prepared.queries[0];
     const executed=await executeSearchCapabilitySelection({
       registry,selection,
       request:{...plan,query:safeQuery,language:globalContext.language??plan.language??'auto',locale:globalContext.locale??plan.locale??null,region:globalContext.questionRegion??globalContext.objectRegion??null,jurisdiction:globalContext.jurisdiction??null,privacy:{sendPolicy:'minimum_necessary',rawOcrIncluded:false,querySanitized:true}},
     });
     if(executed.status!=='completed'){const e=new Error(executed.reason);e.code=executed.reason;e.attempts=executed.attempts;throw e}
     return {...(executed.result??{}),meta:{...(executed.result?.meta??{}),capability:executed.capability,attempts:executed.attempts}};
   }
 };
}

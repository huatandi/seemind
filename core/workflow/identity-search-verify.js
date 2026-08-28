import {buildIdentityVerificationPackage,verifiedEntityCandidate} from '../entity/entity-verification.js';
import {askTeacher} from '../teacher/teacher-orchestrator.js';
import {compileTaskPackage} from '../compiler/task-package-compiler.js';
import {searchResultsToEvidence} from '../search/search-evidence.js';
import {analyzeConsensus} from '../evidence/evidence-consensus.js';
import {planEvidenceRetrieval,buildEscalatedSearchPlan} from '../search/evidence-retrieval-strategy.js';

export async function prepareGroundedTask({taskPackage,observation,receipt,conversation=[],providers=[],searchProvider=null,consent=false,privacyPolicy={},entityCandidates=[],audit=null}={}){
  let pkg=taskPackage;
  let verifiedEntity=null;
  const trace=[];
  if(pkg?.identity?.required && !pkg.identity.ok){
    if(!providers.length)return {status:'needs_identity_teacher',package:pkg,trace:['identity_blocked:no_teacher']};
    const verification=buildIdentityVerificationPackage(pkg);
    audit?.record?.('identity_resolution_started',{taskId:pkg?.task?.id});
    const identityResponse=await askTeacher({taskPackage:verification,providers,consent,privacyPolicy,audit});
    trace.push(`identity_teacher:${identityResponse.status}`);
    if(identityResponse.status!=='ok'||!identityResponse.result?.identityProposal)return {status:'identity_unresolved',package:pkg,identityResponse,trace};
    verifiedEntity=verifiedEntityCandidate(identityResponse.result.identityProposal);audit?.record?.('identity_verified',{taskId:pkg?.task?.id,canonicalName:verifiedEntity?.canonicalName,category:verifiedEntity?.category,confidence:verifiedEntity?.confidence,evidenceRefs:verifiedEntity?.evidenceRefs??[]});
    pkg=compileTaskPackage({task:taskPackage.task,observation,receipt,userIntent:taskPackage.userIntent,conversation,entityCandidates:[...entityCandidates,verifiedEntity]});
    if(taskPackage.media?.length) pkg={...pkg,media:taskPackage.media};
    trace.push(`identity_verified:${verifiedEntity.canonicalName}`);
  }
  if(pkg.search?.required){
    if(pkg.search.blocked)return {status:'identity_unresolved',package:pkg,verifiedEntity,trace:[...trace,'search_blocked:identity']};
    if(!searchProvider)return {status:'search_unavailable',package:{...pkg,search:{...pkg.search,status:'unavailable'}},verifiedEntity,trace:[...trace,'search_unavailable']};
    const maxSearches=Math.max(1,Number(pkg.budget?.maxSearches??3));
    let plan={...pkg.search};
    let mergedEvidence=[...(pkg.evidence??[])];
    let evidenceConsensus=null;
    let retrieval=null;
    let searches=0;
    try{
      while(searches<maxSearches){
        searches+=1;
        audit?.record?.('search_planned',{taskId:pkg?.task?.id,attempt:searches,queryFingerprint:fingerprint(plan.query),freshnessClass:plan.freshnessClass});
        const searched=await searchProvider.search(plan);
        const evidence=searched.evidence??searchResultsToEvidence(searched.results??[],{requestId:searched.requestId??crypto.randomUUID(),freshnessClass:plan.freshnessClass,task:pkg.task});
        mergedEvidence=mergeEvidence(mergedEvidence,evidence);audit?.record?.('search_completed',{taskId:pkg?.task?.id,attempt:searches,queryFingerprint:fingerprint(plan.query),evidenceCount:evidence.length,sourceCount:new Set(evidence.map(e=>e.sourceGroup??e.canonicalSource??e.publisher??e.url).filter(Boolean)).size});
        evidenceConsensus=analyzeConsensus(mergedEvidence.filter(e=>e?.type==='search'),pkg.task??{});
        trace.push(`search_completed:${searches}:${evidence.length}`);
        retrieval=planEvidenceRetrieval({task:{...(pkg.task??{}),identityConfidence:pkg.identity?.confidence??pkg.entityResolution?.primary?.confidence},search:pkg.search,consensus:evidenceConsensus,evidence:mergedEvidence.filter(e=>e?.type==='search'),attempt:searches,maxSearches});
        trace.push(`retrieval:${retrieval.action}:${retrieval.reason}`);
        if(retrieval.action!=='search_more')break;
        const next=buildEscalatedSearchPlan(pkg.search,retrieval,searches+1);
        if(!next)break;
        audit?.record?.('search_escalated',{taskId:pkg?.task?.id,attempt:searches+1,action:retrieval.action,reason:retrieval.reason,queryFingerprint:fingerprint(next.query)});plan=next;
      }
      pkg={...pkg,evidence:mergedEvidence,evidenceConsensus,evidenceRetrieval:retrieval,search:{...pkg.search,status:'completed',resultCount:mergedEvidence.filter(e=>e?.type==='search').length,searchesUsed:searches,maxSearches,consensusRecommendation:evidenceConsensus?.recommendation??null,retrievalAction:retrieval?.action??null,retrievalReason:retrieval?.reason??null}};
      if(evidenceConsensus?.recommendation==='search_more_or_report_disagreement' && retrieval?.action==='report')trace.push('evidence_conflict:report_disagreement');
      else if(evidenceConsensus?.recommendation==='search_more_or_report_disagreement')trace.push('evidence_conflict:unresolved');
    }catch(error){
      pkg={...pkg,evidenceRetrieval:retrieval,search:{...pkg.search,status:'unavailable',searchesUsed:searches,maxSearches}};trace.push('search_failed');
      return {status:'search_unavailable',package:pkg,verifiedEntity,error,trace};
    }
  }
  audit?.record?.('evidence_consensus',{taskId:pkg?.task?.id,status:evidenceConsensus?.status??'none',resolutionStatus:evidenceConsensus?.resolution?.status??null,recommendation:evidenceConsensus?.recommendation??null});
  return {status:'ready',package:pkg,verifiedEntity,trace};
}

function mergeEvidence(existing=[],incoming=[]){
  const m=new Map();
  for(const e of [...existing,...incoming]){
    if(!e)continue;
    const key=e.id??`${e.type??'e'}:${e.url??''}:${e.claimKey??''}:${String(e.claimValue??'')}`;
    m.set(key,e);
  }
  return [...m.values()];
}

function fingerprint(text=''){let h=2166136261;const s=String(text);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

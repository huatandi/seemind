import {assessEvidenceUsability} from '../evidence/evidence-semantics.js';

export function buildEvidenceAnswerContract({answer={},evidence=[],factView=null,verification=null,explanationContract=null,now=null}={}){
  const byId=new Map((evidence??[]).filter(x=>x?.id).map(x=>[x.id,x]));
  const currentFacts=[],historicalFacts=[],userReports=[],inferences=[],conflicts=[],unknowns=[],provenance=[];
  for(const claim of answer.claims??[]){
    const refs=(claim.evidenceRefs??[]).map(id=>byId.get(id)).filter(Boolean);
    const semanticRefs=refs.map(e=>({e,assessment:assessEvidenceUsability(e,{now:now??new Date().toISOString()})}));
    const kinds=[...new Set(semanticRefs.map(x=>x.assessment.semantics.evidenceKind))];
    const active=semanticRefs.filter(x=>x.assessment.usable);
    const record={id:claim.id,text:claim.text,type:claim.type,status:claim.status,confidence:claim.confidence,evidenceRefs:active.map(x=>x.e.id),evidenceKinds:kinds};
    if(claim.type==='unknown'||claim.status==='unknown'||claim.status==='unsupported')unknowns.push(record);
    else if(claim.status==='conflicted')conflicts.push(record);
    else if(kinds.includes('user_report')&&!kinds.some(k=>['observation','external_source','tool_result'].includes(k)))userReports.push(record);
    else if(claim.type==='inference'||kinds.includes('inference')||kinds.includes('teacher_result'))inferences.push(record);
    else currentFacts.push(record);
    for(const x of active){
      const s=x.assessment.semantics;
      provenance.push({evidenceId:x.e.id,kind:s.evidenceKind,observedAt:s.observedAt,assertedAt:s.assertedAt,provenanceRef:s.provenanceRef??null});
    }
  }
  for(const [type,items] of Object.entries(factView?.history??{})){
    for(const item of items??[]){
      if(item.usable)continue;
      historicalFacts.push({type,value:item.value,claimId:item.claimId,source:item.source,semantics:item.semantics,reasons:item.reasons});
    }
  }
  for(const c of factView?.conflicts??[])conflicts.push({type:'temporal_fact_conflict',...c});
  for(const issue of verification?.issues??[]){
    if(String(issue).startsWith('source_conflict:')||String(issue).startsWith('consensus_unresolved:'))conflicts.push({type:'verification_conflict',issue});
    if(String(issue).startsWith('unsupported_')||String(issue).startsWith('freshness_evidence_missing:'))unknowns.push({type:'verification_gap',issue});
  }
  if(explanationContract){
    for(const x of explanationContract.observed?.items??[])currentFacts.push({id:x.id??`observed_${currentFacts.length}`,text:formatObserved(x),type:'fact',status:'supported',confidence:x.confidence??null,evidenceRefs:[],evidenceKinds:['observation']});
    for(const x of explanationContract.userReported?.items??[])userReports.push({id:x.id??`user_${userReports.length}`,text:x.text??`${x.type}: ${x.value??''}`,type:'fact',status:'supported',confidence:x.confidence??null,evidenceRefs:[],evidenceKinds:['user_report']});
    for(const x of explanationContract.assessment?.items??[])inferences.push({id:x.id??`inference_${inferences.length}`,text:x.text??'',type:'inference',status:x.status??'inference',confidence:x.confidence??null,evidenceRefs:[],evidenceKinds:['inference']});
    for(const x of explanationContract.unknowns?.items??[])unknowns.push({id:x.id??`unknown_${unknowns.length}`,text:x.label??x.reason??x.id??'unknown',type:'unknown',status:'unknown'});
  }
  return {
    schemaVersion:1,
    contract:'evidence_to_final_answer',
    currentFacts:dedupe(currentFacts,x=>x.id),
    historicalFacts:dedupe(historicalFacts,x=>`${x.type}|${x.claimId}`),
    userReports:dedupe(userReports,x=>x.id),
    inferences:dedupe(inferences,x=>x.id),
    conflicts:dedupe(conflicts,x=>JSON.stringify(x)),
    unknowns:dedupe(unknowns,x=>JSON.stringify(x)),
    provenance:dedupe(provenance,x=>x.evidenceId),
    canStateAsResolvedFact:verification?.accepted!==false&&conflicts.length===0,
  };
}

export function renderEvidenceAnswer(contract={},fallback=''){
  const out=[];
  section(out,'已确认',contract.currentFacts,x=>x.text);
  section(out,'你提供的信息',contract.userReports,x=>x.text);
  section(out,'我的判断',contract.inferences,x=>x.text);
  section(out,'历史信息',contract.historicalFacts,x=>`${x.type}: ${x.value}`);
  section(out,'存在冲突',contract.conflicts,x=>x.text??x.issue??`${x.type}: ${x.values?.join(' / ')??'证据冲突'}`);
  section(out,'还不能确认',contract.unknowns,x=>x.text??x.issue??x.type);
  return out.join('\n\n')||String(fallback??'');
}
function formatObserved(x){const unit=x.unit?` ${x.unit}`:'';return `${x.label??x.id??'事实'}: ${x.value??''}${unit}`}
function section(out,title,items,fmt){if(items?.length)out.push(`${title}\n${items.map(x=>`- ${fmt(x)}`).join('\n')}`)}
function dedupe(a,key){const m=new Map();for(const x of a)if(!m.has(key(x)))m.set(key(x),x);return [...m.values()]}

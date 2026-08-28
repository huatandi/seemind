import {assessEvidenceUsability} from './evidence-semantics.js';
import {sourceQualityForTask,minimumSourceScore} from './source-quality.js';
import {analyzeConsensus} from './evidence-consensus.js';
import {rankEvidenceAuthority} from './task-aware-authority.js';
const NEEDS_SUPPORT=new Set(['fact','price','safety']);
export function judgeClaims(answer,taskPackage={}){
  const evidenceById=new Map((taskPackage.evidence??[]).filter(e=>e?.id).map(e=>[e.id,e]));
  const allowed=new Set([...evidenceById.keys(),...(taskPackage.media??[]).map(m=>m?.id)].filter(Boolean));
  const freshness=taskPackage.freshness??taskPackage.task?.freshness??{};
  const issues=[]; const judged=[];
  for(const claim of answer.claims??[]){
    const refs=(claim.evidenceRefs??[]).filter(id=>allowed.has(id));
    const unusableRefs=refs.filter(id=>!assessEvidenceUsability(evidenceById.get(id)??{}, {minimumConfidence:0}).usable);
    const usableRefs=refs.filter(id=>!unusableRefs.includes(id));
    const authorityRanking=rankEvidenceAuthority(usableRefs.map(id=>evidenceById.get(id)).filter(Boolean),claim,taskPackage.task??{});
    const authoritySummary={
      strongestSourceId:authorityRanking[0]?.id??null,
      strongestAuthority:authorityRanking[0]?.taskAuthority?.authority??0,
      strongestTier:authorityRanking[0]?.taskAuthority?.tier??null,
      claimClass:authorityRanking[0]?.taskAuthority?.claimClass??null,
      rankedSourceIds:authorityRanking.map(x=>x.id).filter(Boolean),
    };
    let status=claim.status; let consensus=null;
    if(unusableRefs.length)issues.push(`inactive_evidence_ref:${claim.id}`);
    if((claim.evidenceRefs??[]).some(id=>!allowed.has(id))) issues.push(`unknown_evidence_ref:${claim.id}`);
    if(NEEDS_SUPPORT.has(claim.type)){
      if(usableRefs.length===0){status='unsupported';issues.push(`unsupported_${claim.type}:${claim.id}`)}
      else if(!['supported','partially_supported'].includes(status))status='supported';
      if(freshness.required && ['fact','price'].includes(claim.type)){
        const searchRefs=usableRefs.map(id=>evidenceById.get(id)).filter(e=>e?.type==='search');
        const freshRefs=searchRefs.filter(e=>isFresh(e,freshness));
        if(freshRefs.length===0){status='unsupported';issues.push(`freshness_evidence_missing:${claim.id}`)}
        else {
          const threshold=minimumSourceScore(taskPackage.task??{});
          const qualified=freshRefs.filter(e=>sourceQualityForTask(e,taskPackage.task??{}).score>=threshold);
          if(qualified.length===0){status='unsupported';issues.push(`source_quality_insufficient:${claim.id}`)}
          consensus=analyzeConsensus(qualified,taskPackage.task??{});
          const unresolved=consensus.conflicts.filter(c=>c.resolution.status==='unresolved');
          if(unresolved.length){status='conflicted';issues.push(`source_conflict:${claim.id}`);issues.push(`consensus_unresolved:${claim.id}`)}
          else if(consensus.conflicts.length){issues.push(`source_conflict_resolved:${claim.id}`)}
        }
      }
    }
    judged.push({...claim,evidenceRefs:usableRefs,status,consensus,authority:authoritySummary});
  }
  const requiresClaims=Boolean(taskPackage.contract?.requireClaims);
  if(requiresClaims && !(answer.claims??[]).length) issues.push('claims_missing');
  const blocking=issues.filter(x=>x==='claims_missing'||x.startsWith('unsupported_fact:')||x.startsWith('unsupported_price:')||x.startsWith('unsupported_safety:')||x.startsWith('unknown_evidence_ref:')||x.startsWith('inactive_evidence_ref:')||x.startsWith('freshness_evidence_missing:')||x.startsWith('source_quality_insufficient:')||x.startsWith('source_conflict:')||x.startsWith('consensus_unresolved:'));
  return {ok:blocking.length===0,issues,claims:judged};
}

function isFresh(evidence,freshness){
  const maxAge=Number(freshness.maxAgeMs);if(!Number.isFinite(maxAge)||maxAge<=0)return true;
  const stamp=Date.parse(evidence.accessedAt??evidence.publishedAt??'');if(!Number.isFinite(stamp))return false;return Date.now()-stamp<=maxAge;
}

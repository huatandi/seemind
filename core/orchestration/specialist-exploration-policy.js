/**
 * Bounded exploration over already-eligible specialist rankings.
 * It never bypasses capability, privacy, health, safety or user-provider gates.
 */
export function applySpecialistExploration(ranked=[],{enabled=true,explorationRate=.08,requestKey='',minimumEvidenceWeight=6,maximumExplorationRank=3}={}){
  if(!enabled||ranked.length<2)return {selected:ranked[0]??null,ranked,mode:'exploit',explored:false};
  const rows=ranked.map((row,index)=>({...row,exploration:explorationMeta(row,index,{minimumEvidenceWeight})}));
  const top=rows[0],candidates=rows.slice(1,Math.max(2,maximumExplorationRank)).filter(x=>x.exploration.eligible);
  const explore=deterministicUnit(requestKey)<clamp(explorationRate,0,.2)&&candidates.length>0;
  if(!explore)return {selected:top,ranked:rows,mode:'exploit',explored:false};
  candidates.sort((a,b)=>b.exploration.priority-a.exploration.priority);
  return {selected:candidates[0],ranked:rows,mode:'explore',explored:true,reason:'BOUNDED_PROVIDER_EXPLORATION'};
}
function explorationMeta(row,index,{minimumEvidenceWeight}){
  const learned=row.learned??null;
  const weight=Number(learned?.evidenceWeight??learned?.rows?.reduce((s,x)=>s+Number(x.evidenceWeight??0),0)??0);
  const uncertainty=1-Math.min(1,weight/Math.max(1,minimumEvidenceWeight));
  return {eligible:index>0&&uncertainty>.15,uncertainty,evidenceWeight:weight,priority:uncertainty*.7+Number(row.score??0)*.3};
}
function deterministicUnit(key=''){let h=2166136261;for(const c of String(key)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296}
function clamp(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}

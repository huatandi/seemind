import {sourceQualityForTask,minimumSourceScore} from './source-quality.js';

export function analyzeConsensus(evidence=[],task={},options={}){
  const qualified=evidence.map(e=>enrich(e,task)).filter(e=>e.quality.score>=minimumSourceScore(task));
  const families=groupFamilies(qualified);
  const claimGroups=groupClaims(qualified);
  const conflicts=[]; const consensuses=[];
  for(const [claimKey,items] of claimGroups){
    const values=groupValues(items);
    if(values.size>1){
      const rankedValues=[...values.entries()].map(([value,sources])=>({value,sources,score:aggregateSupport(sources)})).sort((a,b)=>b.score-a.score);
      const resolution=resolveConflict(rankedValues,task,options);
      conflicts.push({claimKey,values:rankedValues.map(x=>({value:x.value,score:x.score,sourceIds:x.sources.map(s=>s.id)})),resolution});
    } else if(values.size===1){
      const [[value,sources]]=[...values.entries()];
      consensuses.push({claimKey,value,independentFamilies:new Set(sources.map(s=>s.family)).size,sourceIds:sources.map(s=>s.id),score:aggregateSupport(sources)});
    }
  }
  return {
    qualified,
    independentFamilies:families.size,
    families:[...families.entries()].map(([family,items])=>({family,sourceIds:items.map(i=>i.id)})),
    consensuses,
    conflicts,
    hasConflict:conflicts.length>0,
    recommendation:recommendation(conflicts,consensuses,qualified,task),
  };
}

export function evidenceFamily(e={}){
  const explicit=clean(e.sourceGroup??e.upstreamSource??e.canonicalSource??'');
  if(explicit)return `declared:${explicit}`;
  const publisher=clean(e.publisher??'');
  const origin=sourceOrigin(e.url);
  if(publisher)return `publisher:${publisher}`;
  if(origin)return `origin:${origin}`;
  return `source:${clean(e.id??'unknown')}`;
}

function enrich(e,task){
  const quality=e.sourceQuality?.score!=null?e.sourceQuality:sourceQualityForTask(e,task);
  return {...e,quality,family:evidenceFamily(e),directness:directness(e,quality),freshness:recency(e)};
}
function groupFamilies(items){const m=new Map();for(const e of items){if(!m.has(e.family))m.set(e.family,[]);m.get(e.family).push(e)}return m}
function groupClaims(items){const m=new Map();for(const e of items){if(!e.claimKey||e.claimValue==null)continue;const k=clean(e.claimKey);if(!m.has(k))m.set(k,[]);m.get(k).push(e)}return m}
function groupValues(items){const m=new Map();for(const e of items){const k=normalizeValue(e.claimValue);if(!m.has(k))m.set(k,[]);m.get(k).push(e)}return m}
function aggregateSupport(items){
  const familyBest=new Map();
  for(const e of items){const s=e.quality.score*.55+e.directness*.25+e.freshness*.20;familyBest.set(e.family,Math.max(familyBest.get(e.family)??0,s))}
  const vals=[...familyBest.values()].sort((a,b)=>b-a);if(!vals.length)return 0;
  const base=vals[0];const corroboration=Math.min(.18,Math.max(0,vals.length-1)*.07);return clamp(base+corroboration);
}
function resolveConflict(values,task,{decisiveMargin=.16}={}){
  if(values.length<2)return {status:'none'};
  const [first,second]=values;const margin=first.score-second.score;
  const firstFamilies=new Set(first.sources.map(s=>s.family)).size;
  const secondFamilies=new Set(second.sources.map(s=>s.family)).size;
  if(margin>=decisiveMargin && first.sources.some(s=>s.directness>=.9 || s.quality.tier==='A')){
    return {status:'resolved',preferredValue:first.value,margin,reason:'higher_quality_more_direct_or_fresher_evidence'};
  }
  if(firstFamilies>=2 && firstFamilies>secondFamilies && first.score>=.72){
    return {status:'resolved',preferredValue:first.value,margin,reason:'independent_source_majority',supportingFamilies:firstFamilies,competingFamilies:secondFamilies};
  }
  return {status:'unresolved',preferredValue:null,margin,reason:'independent_high_quality_sources_disagree',nextStep:'search_more_or_report_disagreement'};
}
function recommendation(conflicts,consensuses,qualified,task){
  if(conflicts.some(c=>c.resolution.status==='unresolved'))return 'search_more_or_report_disagreement';
  if(conflicts.length)return 'use_resolved_preference_with_caveat';
  const strong=consensuses.some(c=>c.independentFamilies>=2 && c.score>=minimumSourceScore(task));
  if(strong)return 'accept_consensus';
  if(qualified.length)return 'single_source_caution';
  return 'insufficient_evidence';
}
function directness(e,q){
  if(e.isPrimarySource===true)return 1;
  if(e.isPrimarySource===false)return .55;
  if(['government','official'].includes(q.sourceType))return .92;
  if(q.sourceType==='retailer')return .82;
  if(q.sourceType==='professional_database')return .75;
  if(q.sourceType==='community')return .35;
  return .5;
}
function recency(e){const stamp=Date.parse(e.publishedAt??e.accessedAt??'');if(!Number.isFinite(stamp))return .5;const age=Math.max(0,Date.now()-stamp);const day=86400000;if(age<=day)return 1;if(age<=7*day)return .9;if(age<=30*day)return .8;if(age<=180*day)return .65;if(age<=365*day)return .55;return .4}
function sourceOrigin(url=''){try{return new URL(String(url)).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}}
function clean(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ')}
function normalizeValue(v){return typeof v==='number'?String(v):clean(v)}
function clamp(v){return Math.max(0,Math.min(1,Number(v)||0))}

import {minimumSourceScore} from '../evidence/source-quality.js';

export function planEvidenceRetrieval({task={},search={},consensus=null,evidence=[],attempt=0,maxSearches=3}={}){
  const remaining=Math.max(0,Number(maxSearches||0)-Number(attempt||0));
  if(search?.blocked)return decision('blocked','identity_verification_required',{remainingSearches:remaining});
  if(!search?.required)return decision('stop','search_not_required',{remainingSearches:remaining});
  if(remaining<=0)return decision('report','search_budget_exhausted',{remainingSearches:0,reportAs:'insufficient_or_conflicting_evidence'});

  const profile=retrievalProfile(task);
  const qualified=(evidence??[]).filter(e=>(e?.sourceQuality?.score??0)>=minimumSourceScore(task));
  const recommendation=consensus?.recommendation??(qualified.length?'single_source_caution':'insufficient_evidence');

  if(recommendation==='accept_consensus')return decision('stop','sufficient_independent_consensus',{remainingSearches:remaining,profile});
  if(recommendation==='use_resolved_preference_with_caveat')return decision('stop','conflict_resolved_with_caveat',{remainingSearches:remaining,profile,caveatRequired:true});

  if(identitySensitive(task) && task?.identityConfidence!=null && Number(task.identityConfidence)<.82){
    return decision('verify_identity','identity_too_uncertain_for_more_search',{remainingSearches:remaining,profile});
  }

  if(recommendation==='search_more_or_report_disagreement'){
    return decision('search_more','unresolved_independent_source_conflict',{
      remainingSearches:remaining,
      profile,
      preferredSourceTypes:profile.conflictSourceTypes,
      queryAddon:profile.conflictQueryAddon,
      stopCondition:'independent_high_quality_consensus_or_budget_exhausted',
    });
  }

  return decision('search_more',qualified.length?'single_source_needs_corroboration':'insufficient_qualified_evidence',{
    remainingSearches:remaining,
    profile,
    preferredSourceTypes:profile.preferredSourceTypes,
    queryAddon:profile.queryAddon,
    stopCondition:'qualified_source_or_independent_consensus_or_budget_exhausted',
  });
}

export function buildEscalatedSearchPlan(basePlan={},retrieval={},attempt=1){
  if(retrieval.action!=='search_more')return null;
  const addon=String(retrieval.queryAddon??'').trim();
  const base=String(basePlan.query??'').trim();
  return {
    ...basePlan,
    query:addon?`${base} ${addon}`.trim():base,
    retrievalRound:attempt,
    retrievalReason:retrieval.reason,
    preferredSourceTypes:[...(retrieval.preferredSourceTypes??[])],
    stopCondition:retrieval.stopCondition??null,
    maxResults:Math.min(10,Math.max(Number(basePlan.maxResults)||5,6)),
  };
}

export function retrievalProfile(task={}){
  const hay=`${task.type??''} ${task.userIntent??''}`.toLowerCase();
  if(/law|legal|regulation|法规|法律|规定|移民|税/.test(hay))return {
    kind:'legal',preferredSourceTypes:['government','official'],conflictSourceTypes:['government'],queryAddon:'official government primary source regulation',
    conflictQueryAddon:'official government primary text latest publication',
  };
  if(/medical|health|safety|医疗|健康|安全/.test(hay))return {
    kind:'safety',preferredSourceTypes:['government','official','professional_database'],conflictSourceTypes:['government','official'],queryAddon:'official clinical safety guidance',
    conflictQueryAddon:'official current safety guidance primary source',
  };
  if(/manual|compatib|repair|maintenance|说明书|兼容|维修|保养|配件/.test(hay))return {
    kind:'technical',preferredSourceTypes:['official','professional_database'],conflictSourceTypes:['official'],queryAddon:'official manual specification service documentation',
    conflictQueryAddon:'official manufacturer manual service bulletin specification',
  };
  if(/price|shopping|多少钱|价格|哪里买|购买/.test(hay))return {
    kind:'price',preferredSourceTypes:['retailer','official'],conflictSourceTypes:['retailer'],queryAddon:'current price in stock retailer',
    conflictQueryAddon:'current price independent retailer in stock',
  };
  return {kind:'general',preferredSourceTypes:['official','professional_database','web'],conflictSourceTypes:['official','professional_database'],queryAddon:'authoritative source',conflictQueryAddon:'independent authoritative primary source'};
}

function identitySensitive(task={}){const hay=`${task.type??''} ${task.userIntent??''}`.toLowerCase();return /price|shopping|manual|compatib|repair|maintenance|价格|购买|说明书|兼容|维修|保养|配件/.test(hay)}
function decision(action,reason,extra={}){return {action,reason,...extra}}

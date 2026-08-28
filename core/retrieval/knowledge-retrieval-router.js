export function planKnowledgeRetrieval({observation={},problem={},worldDomain={},intentGraph={},safetyRisk={},localConfidence=null,searchAvailable=true}={}){
  const domain=worldDomain.primary??'general';
  const intents=new Set((intentGraph.intents??[]).map(x=>x.intent));
  const q=String(problem.userQuestion??intentGraph.userText??'').trim();
  const confidence=Number(localConfidence??observation.confidence?.overall??0);
  const needsFreshness=requiresFreshness(q,intents);
  const needsAuthority=requiresAuthority(domain,intents,safetyRisk);
  const needsImageSearch=shouldUseImageSearch({domain,intents,observation});
  const localCanAnswer=confidence>=.78&&!needsFreshness&&!needsAuthority&&!hasMaterialLimitations(observation,problem);
  const shouldSearch=Boolean(searchAvailable&&!localCanAnswer&&(q||observation.detectedType!=='unknown'));
  const sources=rankSourceTypes({domain,intents,needsFreshness,needsAuthority,needsImageSearch});
  return {
    schemaVersion:1,
    localCanAnswer,
    shouldSearch,
    reason:localCanAnswer?'local_evidence_sufficient':shouldSearch?'retrieval_can_reduce_uncertainty':'search_unavailable_or_not_useful',
    needsFreshness,needsAuthority,needsImageSearch,
    queries:shouldSearch?buildQueries({q,observation,domain,intents}):[],
    preferredSources:sources,
    minimumSources:needsAuthority?2:1,
    requireCrossCheck:needsAuthority||confidence<.55,
    citationRequired:shouldSearch,
    capabilityNeeds:buildCapabilityNeeds({domain,intents,needsFreshness,needsAuthority,needsImageSearch,sources}),
  };
}

export function evaluateRetrievalResults({plan={},results=[]}={}){
  const normalized=(results??[]).map(normalizeResult).filter(Boolean);
  const authoritative=normalized.filter(x=>x.authorityScore>=.8);
  const diverseDomains=new Set(normalized.map(x=>x.domain).filter(Boolean));
  const enough=normalized.length>=Number(plan.minimumSources??1);
  const crossCheckOk=!plan.requireCrossCheck||diverseDomains.size>=2||authoritative.length>=2;
  const quality=normalized.length?normalized.reduce((s,x)=>s+x.qualityScore,0)/normalized.length:0;
  const canAnswer=enough&&crossCheckOk&&quality>=.62;
  return {
    schemaVersion:1,
    canAnswer,
    quality,
    resultCount:normalized.length,
    authoritativeCount:authoritative.length,
    crossCheckOk,
    results:normalized,
    unresolvedReason:canAnswer?null:!enough?'insufficient_results':!crossCheckOk?'insufficient_cross_check':'low_source_quality',
  };
}

export function decideEscalationAfterRetrieval({retrievalPlan={},retrievalEvaluation={},intentGraph={},safetyRisk={},specialistAdvantage=false}={}){
  if(safetyRisk?.level==='R3')return {decision:'specialist_or_human',reason:'safety_requires_escalation'};
  if(retrievalPlan.localCanAnswer)return {decision:'local',reason:'local_evidence_sufficient'};
  if(retrievalPlan.shouldSearch&&retrievalEvaluation.canAnswer&&!specialistAdvantage)return {decision:'retrieved_answer',reason:'public_sources_sufficient'};
  if(retrievalPlan.shouldSearch&&!retrievalEvaluation.canAnswer)return {decision:'specialist_or_tool',reason:'retrieval_insufficient'};
  if(specialistAdvantage)return {decision:'specialist_or_tool',reason:'specialist_clear_advantage'};
  if((intentGraph.intents??[]).some(x=>['find','route_to_specialist'].includes(x.intent)))return {decision:'specialist_or_search',reason:'user_requested_external_help'};
  return {decision:'local_or_clarify',reason:'no_external_path_needed'};
}

export function buildRetrievalAnswerContract({evaluation={},query='',domain='general'}={}){
  return {
    schemaVersion:1,
    domain,
    query,
    answerPolicy:{
      synthesize:true,
      attributeSources:true,
      separateFactsFromInference:true,
      preserveUncertainty:true,
      doNotPresentSearchSnippetAsVerifiedFact:true,
    },
    sources:evaluation.results.map(x=>({title:x.title,url:x.url,domain:x.domain,authorityScore:x.authorityScore,qualityScore:x.qualityScore})),
  };
}

function buildQueries({q,observation,domain,intents}){
  const text=String(observation.extractedText??'').replace(/\s+/g,' ').trim().slice(0,180);
  const identity=(observation.observations??[]).filter(x=>x.kind==='general_vision').flatMap(x=>x.identity??[]).sort((a,b)=>(b.confidence??0)-(a.confidence??0))[0]?.label??'';
  const base=[q,identity,text].filter(Boolean).join(' ').trim();
  const queries=[base||`${domain} identification`];
  if(intents.has('authenticity'))queries.push(`${base} official authenticity verification`);
  if(intents.has('find'))queries.push(`${base} official site`);
  if(domain==='product')queries.push(`${base} manufacturer manual model`);
  if(domain==='plant')queries.push(`${base} plant identification leaf symptoms`);
  if(domain==='animal')queries.push(`${base} species identification`);
  if(domain==='document')queries.push(`${base} official document guidance`);
  return [...new Set(queries)].slice(0,3);
}
function rankSourceTypes({domain,intents,needsFreshness,needsAuthority,needsImageSearch}){
  const out=[];
  if(needsAuthority)out.push('official_source','authoritative_database');
  if(needsFreshness)out.push('current_web');
  if(needsImageSearch)out.push('image_search');
  if(domain==='product')out.push('manufacturer','manual');
  if(domain==='place')out.push('maps_or_local_source');
  if(domain==='plant'||domain==='animal')out.push('specialist_database');
  if(intents.has('find'))out.push('search_engine');
  out.push('reputable_web');
  return [...new Set(out)];
}
function requiresFreshness(q,intents){return /(今天|现在|最新|价格|营业|哪里买|current|latest|today|price|open now)/i.test(q)||intents.has('find')}
function requiresAuthority(domain,intents,risk){return risk?.level==='R2'||['finance'].includes(domain)||intents.has('authenticity')}
function shouldUseImageSearch({domain,intents,observation}){return ['plant','animal','product','place','general'].includes(domain)&&(intents.has('identify')||observation.detectedType==='unknown')}
function hasMaterialLimitations(o,p){return Boolean((o.limitations??[]).length||(p.problemSignals??[]).some(x=>x.severity==='medium'||x.severity==='high'))}
function normalizeResult(x){
 if(!x)return null;
 const url=String(x.url??x.link??'');let domain=null;try{domain=new URL(url).hostname}catch{}
 const authorityScore=Number(x.authorityScore??inferAuthority(domain,x));
 const relevance=Number(x.relevance??x.score??.65);
 const freshness=Number(x.freshnessScore??.6);
 const qualityScore=Math.max(0,Math.min(1,authorityScore*.45+relevance*.4+freshness*.15));
 return {title:String(x.title??''),url,snippet:String(x.snippet??x.text??'').slice(0,600),domain,authorityScore,relevance,freshness,qualityScore};
}
function inferAuthority(domain,x){
 if(x.official===true)return .95;
 if(!domain)return .45;
 if(/\.(gov|edu)(\.|$)/i.test(domain))return .9;
 if(/who\.int$|nih\.gov$|europa\.eu$|wikipedia\.org$/i.test(domain))return .82;
 return .62;
}

function buildCapabilityNeeds({domain,intents,needsFreshness,needsAuthority,needsImageSearch,sources}){
 return {
   domain,
   freshness:needsFreshness,
   authority:needsAuthority,
   imageSimilarity:needsImageSearch,
   local:domain==='place'||domain==='local',
   product:domain==='product',
   specialist:['plant','animal','medical'].includes(domain),
   preferredSourceTypes:[...sources],
   userFindIntent:intents.has('find'),
 };
}

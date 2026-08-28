const GOVERNMENT_HINTS=[/\.gov(?:\.|\/|$)/i,/\.gob\.mx(?:\/|$)/i,/government/i,/gobierno/i,/secretar[ií]a/i,/instituto nacional/i];
const OFFICIAL_HINTS=[/official/i,/oficial/i,/manufacturer/i,/fabricante/i,/brand/i,/marca/i];
const DATABASE_HINTS=[/database/i,/wikidata/i,/gbif/i,/open food facts/i,/manualslib/i];
const COMMUNITY_HINTS=[/reddit/i,/forum/i,/foro/i,/community/i,/comunidad/i];
const MARKET_HINTS=[/store/i,/shop/i,/tienda/i,/dealer/i,/distribuidor/i,/retailer/i,/mercado/i,/walmart/i,/amazon/i,/homedepot/i,/costco/i];

export function classifySource(evidence={}){
  const hay=`${evidence.url??''} ${evidence.publisher??''} ${evidence.title??''}`.toLowerCase();
  if(GOVERNMENT_HINTS.some(r=>r.test(hay))) return 'government';
  if(COMMUNITY_HINTS.some(r=>r.test(hay))) return 'community';
  if(DATABASE_HINTS.some(r=>r.test(hay))) return 'professional_database';
  if(MARKET_HINTS.some(r=>r.test(hay))) return 'retailer';
  if(OFFICIAL_HINTS.some(r=>r.test(hay))) return 'official';
  return 'web';
}

export function sourceQualityForTask(evidence={},task={}){
  const sourceType=evidence.sourceType??classifySource(evidence);
  const type=String(task.type??'').toLowerCase();
  const intent=String(task.userIntent??'').toLowerCase();
  const price=/price|shopping|多少钱|价格|哪里买|购买/.test(`${type} ${intent}`);
  const legal=/law|legal|regulation|法规|法律|规定|移民|税/.test(`${type} ${intent}`);
  const safety=/medical|health|safety|医疗|健康|安全/.test(`${type} ${intent}`);
  const manual=/manual|compatib|repair|maintenance|说明书|兼容|维修|保养|配件/.test(`${type} ${intent}`);
  const base={government:.96,official:.92,professional_database:.86,retailer:.74,web:.58,community:.42}[sourceType]??.5;
  let fit=.75;
  if(legal||safety) fit=sourceType==='government'?1:sourceType==='official'?.8:sourceType==='professional_database'?.72:.35;
  else if(price) fit=sourceType==='retailer'?1:sourceType==='official'?.82:sourceType==='web'?.7:.55;
  else if(manual) fit=sourceType==='official'?1:sourceType==='professional_database'?.82:sourceType==='government'?.75:sourceType==='web'?.55:.4;
  else fit=sourceType==='community'?.55:.85;
  const credibility=clamp(evidence.credibility??.5);
  const relevance=clamp(evidence.relevance??.7);
  const score=clamp(base*.5+fit*.3+credibility*.1+relevance*.1);
  return {sourceType,score,taskFit:fit,authority:base,tier:tier(score)};
}

export function rankEvidenceForTask(evidence=[],task={}){
  return evidence.map(e=>({...e,sourceQuality:sourceQualityForTask(e,task)})).sort((a,b)=>(b.sourceQuality?.score??0)-(a.sourceQuality?.score??0));
}

export function evidenceQualitySummary(evidence=[],task={}){
  const ranked=rankEvidenceForTask(evidence,task);
  const usable=ranked.filter(e=>(e.sourceQuality?.score??0)>=minimumSourceScore(task));
  const sourceTypes=[...new Set(usable.map(e=>e.sourceQuality?.sourceType).filter(Boolean))];
  return {ranked,usable,sourceTypes,bestScore:ranked[0]?.sourceQuality?.score??0,minimumScore:minimumSourceScore(task)};
}

export function minimumSourceScore(task={}){
  const hay=`${task.type??''} ${task.userIntent??''}`.toLowerCase();
  if(/law|legal|regulation|法规|法律|规定|medical|health|医疗|健康|安全/.test(hay)) return .72;
  if(/manual|compatib|repair|maintenance|说明书|兼容|维修|保养|配件/.test(hay)) return .65;
  if(/price|shopping|多少钱|价格|哪里买|购买/.test(hay)) return .58;
  return .5;
}

export function analyzeEvidenceSet(evidence=[],task={}){
  const ranked=rankEvidenceForTask(evidence,task);
  const origins=new Set(ranked.map(e=>sourceOrigin(e.url)).filter(Boolean));
  const publishers=new Set(ranked.map(e=>String(e.publisher??'').trim().toLowerCase()).filter(Boolean));
  const byKey=new Map();
  for(const e of ranked){
    if(!e.claimKey||e.claimValue==null)continue;
    const key=String(e.claimKey).toLowerCase();
    const value=normalizeClaimValue(e.claimValue);
    if(!byKey.has(key))byKey.set(key,new Set());
    byKey.get(key).add(value);
  }
  const conflicts=[...byKey.entries()].filter(([,values])=>values.size>1).map(([claimKey,values])=>({claimKey,values:[...values]}));
  return {ranked,independentOrigins:origins.size,independentPublishers:publishers.size,conflicts,hasConflict:conflicts.length>0};
}

function sourceOrigin(url=''){try{return new URL(String(url)).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}}
function normalizeClaimValue(v){return typeof v==='number'?String(v):String(v).trim().toLowerCase().replace(/\s+/g,' ')}

function tier(score){return score>=.88?'A':score>=.74?'B':score>=.6?'C':score>=.45?'D':'E'}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):.5}

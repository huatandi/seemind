const LIVE_PATTERNS=[/现在|当前|今天|今日|此刻|实时|库存|营业|开门|关门|汇率|天气|航班|路况|today|now|current|live|open now|in stock|exchange rate|weather|hoy|ahora|actual|abierto|existencia|tipo de cambio/i];
const FAST_PATTERNS=[/价格|多少钱|便宜|哪里买|最新|新闻|活动|优惠|折扣|法规|规定|政策|预约|票价|price|cost|cheapest|latest|news|sale|discount|law|regulation|policy|availability|precio|cuánto|barato|últim|noticia|oferta|ley|reglamento|disponibilidad/i];
const SLOW_PATTERNS=[/规格|参数|型号|说明书|兼容|成分|保修|spec|manual|model|compatib|warranty|especific|manual|modelo|compatib|garantía/i];

export function analyzeFreshness(text='',overrides={}){
  const value=String(text||'').trim();
  let freshnessClass='STATIC',required=false,maxAgeMs=null,reasons=[];
  if(LIVE_PATTERNS.some(r=>r.test(value))){freshnessClass='LIVE';required=true;maxAgeMs=15*60*1000;reasons.push('query_requires_live_information');}
  else if(FAST_PATTERNS.some(r=>r.test(value))){freshnessClass='FAST_CHANGING';required=true;maxAgeMs=24*60*60*1000;reasons.push('query_requires_current_information');}
  else if(SLOW_PATTERNS.some(r=>r.test(value))){freshnessClass='SLOW_CHANGING';required=false;maxAgeMs=90*24*60*60*1000;reasons.push('information_may_change_over_time');}
  if(overrides.required===true){required=true;reasons.push('explicit_freshness_requirement');}
  if(overrides.freshnessClass)freshnessClass=overrides.freshnessClass;
  if(overrides.maxAgeMs!=null)maxAgeMs=overrides.maxAgeMs;
  return {required,freshnessClass,maxAgeMs,reasons:[...new Set(reasons)],evaluatedAt:new Date().toISOString()};
}

export function applyFreshnessToTask(task={}){
  const analysis=analyzeFreshness(task.userIntent,{required:task.realtimeRequired||task.webSearchRequired});
  const needsSearch=Boolean(task.webSearchRequired||analysis.required);
  return {...task,realtimeRequired:Boolean(task.realtimeRequired||analysis.freshnessClass==='LIVE'),webSearchRequired:needsSearch,freshness:analysis,requiredCapabilities:[...new Set(task.requiredCapabilities??[])],externalCapabilities:[...new Set([...(task.externalCapabilities??[]),...(needsSearch?['web_search']:[])])]};
}

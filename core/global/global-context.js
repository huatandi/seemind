export function createGlobalContext(input={}){
 return {
  schemaVersion:1,
  userRegion:normalizeRegion(input.userRegion),
  questionRegion:normalizeRegion(input.questionRegion),
  objectRegion:normalizeRegion(input.objectRegion),
  sourceRegion:normalizeRegion(input.sourceRegion),
  jurisdiction:normalizeRegion(input.jurisdiction),
  language:normalizeLanguage(input.language),
  documentLanguage:normalizeLanguage(input.documentLanguage),
  locale:normalizeLocale(input.locale),
  currency:normalizeCurrency(input.currency),
  measurementSystem:input.measurementSystem??null,
  timezone:input.timezone??null,
  confidence:{...(input.confidence??{})},
  evidence:[...(input.evidence??[])],
  conflicts:[...(input.conflicts??[])],
 };
}

export function resolveGlobalContext({task={},observation={},entity=null,userEnvironment={},conversation=[]}={}){
 const text=[task.userIntent,observation.extractedText,...(conversation??[]).slice(-4).map(x=>x.text)].filter(Boolean).join('\n');
 const explicit=detectExplicitRegions(text);
 const objectRegion=normalizeRegion(entity?.region??detectObjectRegion(observation));
 const userRegion=normalizeRegion(userEnvironment.region);
 const questionRegion=explicit[0]??normalizeRegion(task.questionRegion);
 const jurisdiction=normalizeRegion(task.jurisdiction)??questionRegion;
 const language=normalizeLanguage(task.language==='auto'?detectLanguage(text):task.language);
 const documentLanguage=normalizeLanguage(detectLanguage(observation.extractedText??''));
 const locale=normalizeLocale(task.locale??userEnvironment.locale);
 const currency=normalizeCurrency(task.currency??detectCurrency(observation.extractedText??'',{questionRegion,objectRegion,locale}));
 return createGlobalContext({
  userRegion,questionRegion,objectRegion,jurisdiction,language,documentLanguage,locale,currency,
  measurementSystem:task.measurementSystem??userEnvironment.measurementSystem??null,
  timezone:task.timezone??userEnvironment.timezone??null,
  evidence:[
   ...(questionRegion?[{field:'questionRegion',source:'explicit_text_or_task',value:questionRegion}]:[]),
   ...(objectRegion?[{field:'objectRegion',source:'entity_or_observation',value:objectRegion}]:[]),
   ...(userRegion?[{field:'userRegion',source:'runtime_environment',value:userRegion}]:[]),
  ],
  conflicts:detectRegionConflicts({userRegion,questionRegion,objectRegion}),
 });
}

export function effectiveRegion(context={},purpose='general'){
 if(purpose==='law'||purpose==='official_source')return context.jurisdiction??context.questionRegion??context.objectRegion??null;
 if(purpose==='product')return context.objectRegion??context.questionRegion??null;
 if(purpose==='local')return context.questionRegion??context.userRegion??null;
 return context.questionRegion??context.objectRegion??context.userRegion??null;
}

export function mergeGlobalContext(base={},patch={}){
 const b=createGlobalContext(base),p=createGlobalContext(patch);
 const out={...b};
 for(const key of ['userRegion','questionRegion','objectRegion','sourceRegion','jurisdiction','language','documentLanguage','locale','currency','measurementSystem','timezone'])
   if(p[key]!=null)out[key]=p[key];
 out.evidence=[...(b.evidence??[]),...(p.evidence??[])];
 out.conflicts=[...(b.conflicts??[]),...(p.conflicts??[])];
 return out;
}

function detectExplicitRegions(text=''){
 const rules=[
  [/\b(?:mexico|méxico|mexican[oa]?|墨西哥)\b/i,'MX'],[/(?:\b(?:united states|usa|u\.s\.)\b|美国)/i,'US'],
  [/\b(?:china|中国|中华人民共和国)\b/i,'CN'],[/(?:\bjapan\b|日本)/i,'JP'],
  [/\b(?:canada|加拿大)\b/i,'CA'],[/\b(?:spain|españa|西班牙)\b/i,'ES'],
  [/\b(?:france|法国)\b/i,'FR'],[/\b(?:germany|deutschland|德国)\b/i,'DE'],
  [/\b(?:united kingdom|uk|britain|英国)\b/i,'GB'],[/\b(?:brazil|brasil|巴西)\b/i,'BR'],
 ];
 return rules.filter(([re])=>re.test(text)).map(([,r])=>r);
}
function detectObjectRegion(o={}){
 const regions=(o.observations??[]).flatMap(x=>[...(x.identity??[]),...(x.entities??[])]).map(x=>x.region).filter(Boolean);
 return regions[0]??null;
}
function detectLanguage(text=''){
 const s=String(text);if(!s)return null;
 if(/[\u4e00-\u9fff]/.test(s))return 'zh';
 if(/[\u3040-\u30ff]/.test(s))return 'ja';
 if(/[áéíóúñ¿¡]/i.test(s)||/\b(?:que|para|con|total|gracias|factura)\b/i.test(s))return 'es';
 if(/[A-Za-z]/.test(s))return 'en';
 return null;
}
function detectCurrency(text,{questionRegion,objectRegion,locale}={}){
 const s=String(text);
 if(/\b(?:USD|US\$)\b/i.test(s))return 'USD';if(/\b(?:MXN|M\.?N\.?)\b/i.test(s))return 'MXN';
 if(/\bEUR\b|€/.test(s))return 'EUR';if(/\bJPY\b|¥/.test(s)&&objectRegion==='JP')return 'JPY';
 const region=questionRegion??objectRegion??regionFromLocale(locale);
 return ({MX:'MXN',US:'USD',JP:'JPY',GB:'GBP',CN:'CNY',CA:'CAD',BR:'BRL'})[region]??null;
}
function detectRegionConflicts({userRegion,questionRegion,objectRegion}){
 const vals=[userRegion,questionRegion,objectRegion].filter(Boolean);const unique=[...new Set(vals)];
 return unique.length>1?[{type:'multi_region_context',values:unique,meaning:'regions_are_distinct_contexts_not_an_error'}]:[];
}
function regionFromLocale(l){return String(l??'').split('-')[1]?.toUpperCase()??null}
function normalizeRegion(v){const s=String(v??'').trim();return s?s.toUpperCase():null}
function normalizeLanguage(v){const s=String(v??'').trim();return s&&s!=='auto'?s:null}
function normalizeLocale(v){const s=String(v??'').trim();return s||null}
function normalizeCurrency(v){const s=String(v??'').trim();return s?s.toUpperCase():null}

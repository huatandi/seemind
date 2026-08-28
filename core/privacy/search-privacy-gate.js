const PATTERNS=[
 {type:'email',re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi},
 {type:'phone',re:/\b(?:\+?52[\s.-]*)?(?:\d[\s.-]?){10}\b/g},
 {type:'card_or_account',re:/\b(?:\d[ -]*?){13,19}\b/g},
 {type:'clabe',re:/\b\d{18}\b/g},
 {type:'rfc',re:/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi},
 {type:'curp',re:/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi},
 {type:'ipv4',re:/\b(?:\d{1,3}\.){3}\d{1,3}\b/g},
 {type:'long_reference',re:/\b(?=[A-Z0-9]{12,}\b)(?=[A-Z0-9]*\d)[A-Z0-9]{12,}\b/gi},
];

export function assessSearchPrivacy({query='',task={},worldDomain={},observation={},policy={}}={}){
 const original=String(query??'');
 const domain=worldDomain.primary??task.domain??'general';
 const sensitiveDomain=['finance','medical','health','identity','legal'].includes(domain)||Boolean(task.sensitiveData);
 const findings=detectSensitiveText(original);
 const ocr=String(observation.extractedText??'');
 const ocrFindings=detectSensitiveText(ocr);
 const total=[...findings,...ocrFindings];
 const allowExternal=policy.allowExternalSearch!==false;
 const requiresConsent=Boolean(policy.requireConsentForSensitiveSearch!==false&&(sensitiveDomain||total.some(x=>['card_or_account','clabe','rfc','curp'].includes(x.type))));
 const blocked=Boolean(!allowExternal);
 return {
   schemaVersion:1,
   sensitive:sensitiveDomain||total.length>0,
   domain,
   findings:dedupeFindings(total),
   requiresConsent,
   blocked,
   reason:blocked?'external_search_disabled':requiresConsent?'sensitive_external_search_requires_minimization':'search_allowed_with_minimization',
 };
}

export function sanitizeSearchQuery(query,{preserveQuotedTerms=false,maxLength=240}={}){
 let text=String(query??'');
 const redactions=[];
 for(const p of PATTERNS){
   text=text.replace(p.re,m=>{redactions.push({type:p.type,length:m.length});return tokenFor(p.type)});
 }
 // Common labels followed by personal values: keep the semantic field, discard the value.
 text=text
   .replace(/\b(?:nombre|name|titular|beneficiario|beneficiary|cliente|customer)\s*[:#-]?\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.' -]{2,50}/gi,'person')
   .replace(/\b(?:cuenta|account|tarjeta|card|clabe|rfc|curp|folio|referencia|reference)\s*[:#-]?\s*[A-Z0-9*.-]{4,}/gi,m=>m.split(/[:#-]/)[0].trim())
   .replace(/\s+/g,' ')
   .trim();
 if(!preserveQuotedTerms)text=text.replace(/["“”]/g,'');
 if(text.length>maxLength)text=text.slice(0,maxLength).trim();
 return {query:text,redactions,changed:text!==String(query??'')};
}

export function buildSafeSearchQueries({queries=[],task={},worldDomain={},observation={},policy={}}={}){
 const assessments=[];
 const safe=[];
 for(const query of queries){
   const assessment=assessSearchPrivacy({query,task,worldDomain,observation,policy});
   const sanitized=sanitizeSearchQuery(query,{maxLength:policy.maxQueryLength??240});
   assessments.push({originalFingerprint:fingerprint(query),assessment,sanitized});
   if(!assessment.blocked&&sanitized.query&&meaningful(sanitized.query))safe.push(sanitized.query);
 }
 return {
   schemaVersion:1,
   allowed:safe.length>0,
   requiresConsent:assessments.some(x=>x.assessment.requiresConsent),
   queries:[...new Set(safe)].slice(0,3),
   assessments,
   sendPolicy:'minimum_necessary',
   rawOcrIncluded:false,
 };
}

export function detectSensitiveText(value=''){
 const text=String(value??'');const out=[];
 for(const p of PATTERNS){
   p.re.lastIndex=0;
   for(const m of text.matchAll(p.re))out.push({type:p.type,start:m.index??0,length:m[0].length});
 }
 return out;
}
function tokenFor(type){return ({email:'email',phone:'phone',card_or_account:'account',clabe:'clabe',rfc:'rfc',curp:'curp',ipv4:'ip',long_reference:'reference'})[type]??'private'}
function meaningful(q){return q.replace(/\b(email|phone|account|clabe|rfc|curp|reference|person)\b/gi,'').trim().length>=3}
function dedupeFindings(items){const seen=new Set();return items.filter(x=>{const k=`${x.type}:${x.start}:${x.length}`;if(seen.has(k))return false;seen.add(k);return true})}
function fingerprint(text=''){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

const DEFAULT_SENSITIVE_PATTERNS = [
  {type:'email', re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi},
  {type:'phone', re:/\b(?:\+?52\s*)?(?:\d[\s.-]?){10}\b/g},
  {type:'card', re:/\b(?:\d[ -]*?){13,19}\b/g},
  {type:'rfc', re:/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi},
];

export function sanitizeTaskPackage(taskPackage, policy = {}) {
  const mode = policy.mode ?? 'minimum_necessary';
  const allowRawText = Boolean(policy.allowRawText);
  const includeConversationTurns = Math.max(0, Math.min(8, Number(policy.includeConversationTurns ?? 4)));
  const allowImages = Boolean(policy.allowImages);
  const clone = structuredCloneSafe(taskPackage ?? {});
  clone.safety = {...(clone.safety ?? {}), sendPolicy: mode};
  clone.conversation = (clone.conversation ?? []).slice(-includeConversationTurns).map(t => ({...t,text:redactText(t.text)}));
  clone.observations = (clone.observations ?? []).map(o => ({
    schemaVersion:o.schemaVersion,
    modality:o.modality,
    detectedType:o.detectedType,
    extractedText:allowRawText?redactText(o.extractedText):summarizeText(o.extractedText),
    confidence:o.confidence,
    limitations:o.limitations,
  }));
  clone.evidence = (clone.evidence ?? []).map(e => sanitizeEvidence(e));
  clone.collaboration = sanitizeCollaboration(clone.collaboration);
  clone.precisionEscalation = sanitizePrecisionEscalation(clone.precisionEscalation);
  clone.evidenceConsensus = sanitizeConsensus(clone.evidenceConsensus);
  clone.evidenceRetrieval = sanitizeRetrieval(clone.evidenceRetrieval);
  clone.planning = sanitizePlanning(clone.planning);
  clone.media = allowImages ? sanitizeMedia(clone.media ?? []) : [];
  return { package: clone, redaction: { mode, allowRawText, allowImages, conversationTurns: includeConversationTurns } };
}

export function redactText(value='') {
  let text=String(value ?? '');
  for(const p of DEFAULT_SENSITIVE_PATTERNS) text=text.replace(p.re,`[REDACTED_${p.type.toUpperCase()}]`);
  return text;
}
function summarizeText(value=''){
  const redacted=redactText(value).replace(/\s+/g,' ').trim();
  return redacted.length<=1200?redacted:`${redacted.slice(0,1200)}…`;
}
function sanitizeEvidence(e={}){
  if(e?.type==='search') return {
    id:e.id,type:'search',title:redactText(String(e.title??'').slice(0,300)),url:String(e.url??'').slice(0,2000),
    publisher:e.publisher?redactText(String(e.publisher).slice(0,200)):null,publishedAt:e.publishedAt??null,accessedAt:e.accessedAt??null,
    snippet:redactText(String(e.snippet??'').slice(0,1200)),relevance:e.relevance,credibility:e.credibility,supports:e.supports??[],freshnessClass:e.freshnessClass??null,sourceQuality:e.sourceQuality??null,claimKey:e.claimKey??null,claimValue:e.claimValue??null,sourceGroup:e.sourceGroup??null,upstreamSource:e.upstreamSource??null,canonicalSource:e.canonicalSource??null,isPrimarySource:e.isPrimarySource??null,
    provenance:sanitizeProvenance(e.provenance),
  };
  return {
    schemaVersion:e.schemaVersion,id:e.id,type:e.type,field:e.field,value:e.value,normalizedValue:e.normalizedValue,confidence:e.confidence,rule:e.rule,source:e.source,
    sourceText:e.sourceText?redactText(String(e.sourceText).slice(0,240)):'',status:e.status,accessedAt:e.accessedAt??null,publishedAt:e.publishedAt??null,
  };
}
function structuredCloneSafe(v){ return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)); }

function sanitizeMedia(items=[]){return items.slice(0,1).filter(x=>x?.type==='image').map(x=>({schemaVersion:x.schemaVersion,id:x.id,type:'image',source:x.source,mimeType:x.mimeType,width:x.width,height:x.height,byteLength:x.byteLength,dataUrl:x.dataUrl}));}

function sanitizeCollaboration(c){
  if(!c||typeof c!=='object')return c??null;
  return {schemaVersion:c.schemaVersion,summary:redactText(c.summary??''),known:(c.known??[]).slice(0,12).map(sanitizeEvidence),uncertain:(c.uncertain??[]).slice(0,12).map(x=>({...sanitizeEvidence(x),reason:x.reason,expected:x.expected,deltaMinor:x.deltaMinor})),unknown:(c.unknown??[]).slice(0,12).map(x=>({field:x.field,reason:x.reason})),limitations:(c.limitations??[]).slice(0,8).map(redactText),teacherQuestions:(c.teacherQuestions??[]).slice(0,5).map(redactText),focus:(c.focus??[]).slice(0,8).map(x=>({field:x.field,bbox:x.bbox??null,sourceText:redactText(String(x.sourceText??'').slice(0,240)),reason:x.reason})),confidence:c.confidence??{},calibration:c.calibration??null};
}

function sanitizeConsensus(c){
  if(!c||typeof c!=='object')return c??null;
  return {independentFamilies:Number(c.independentFamilies??0),recommendation:c.recommendation??null,consensuses:(c.consensuses??[]).slice(0,12).map(x=>({claimKey:x.claimKey,value:x.value,independentFamilies:x.independentFamilies,sourceIds:(x.sourceIds??[]).slice(0,10),score:x.score})),conflicts:(c.conflicts??[]).slice(0,12).map(x=>({claimKey:x.claimKey,values:(x.values??[]).slice(0,8).map(v=>({value:v.value,score:v.score,sourceIds:(v.sourceIds??[]).slice(0,10)})),resolution:x.resolution??null}))};
}

function sanitizeRetrieval(r){
  if(!r||typeof r!=='object')return r??null;
  return {action:r.action??null,reason:r.reason??null,remainingSearches:Number(r.remainingSearches??0),preferredSourceTypes:(r.preferredSourceTypes??[]).slice(0,8),queryAddon:redactText(String(r.queryAddon??'').slice(0,300)),stopCondition:r.stopCondition??null,caveatRequired:Boolean(r.caveatRequired),reportAs:r.reportAs??null,profile:r.profile?{kind:r.profile.kind??null}:null};
}

function sanitizePlanning(p){
  if(!p||typeof p!=='object')return p??null;
  return {schemaVersion:p.schemaVersion,graphId:p.graphId??null,state:p.state??null,stopReason:p.stopReason??null,budget:p.budget?{maxSteps:p.budget.maxSteps,maxFailures:p.budget.maxFailures,maxRetries:p.budget.maxRetries,maxLatencyMs:p.budget.maxLatencyMs}:null,counters:p.counters?{steps:p.counters.steps,failures:p.counters.failures,retries:p.counters.retries}:null,nodes:(p.nodes??[]).slice(0,20).map(n=>({id:n.id,type:n.type,state:n.state,dependencies:(n.dependencies??[]).slice(0,12),optional:Boolean(n.optional),retries:n.retries,maxRetries:n.maxRetries,stopCondition:n.stopCondition,escalationCondition:n.escalationCondition,metadata:{requiredCapabilities:(n.metadata?.requiredCapabilities??[]).slice(0,8),evidenceTarget:n.metadata?.evidenceTarget??null,freshness:n.metadata?.freshness??null}}))};
}

function sanitizeProvenance(p){
  if(!p||typeof p!=='object')return null;
  return {
    schemaVersion:p.schemaVersion,sourceId:p.sourceId??null,url:String(p.url??'').slice(0,2000),hostname:p.hostname??null,
    title:redactText(String(p.title??'').slice(0,300)),publisher:p.publisher?redactText(String(p.publisher).slice(0,200)):null,
    sourceType:p.sourceType??null,publishedAt:p.publishedAt??null,accessedAt:p.accessedAt??null,fetchedVia:p.fetchedVia??null,
    queryFingerprint:p.queryFingerprint??null,requestId:p.requestId??null,canonicalSource:p.canonicalSource??null,upstreamSource:p.upstreamSource??null,
    license:p.license??{id:'unknown',commercialUse:null,redistribution:null},attributionRequired:p.attributionRequired!==false,cachePolicy:p.cachePolicy??'metadata_only'
  };
}

function sanitizePrecisionEscalation(x){
 if(!x||typeof x!=='object')return x??null;
 return {schemaVersion:x.schemaVersion,residualOnly:Boolean(x.residualOnly),evidenceGap:x.evidenceGap??null,unresolved:x.unresolved??{},focus:{bbox:x.focus?.bbox??null,targets:(x.focus?.targets??[]).slice(0,8).map(t=>({field:t.field,bbox:t.bbox??null,reason:t.reason}))},candidates:(x.candidates??[]).slice(0,8).map(c=>({field:c.field,value:redactText(String(c.value??'')),confidence:c.confidence,reason:c.reason})),request:x.request?{goal:redactText(x.request.goal??''),fields:(x.request.fields??[]).slice(0,8),candidates:(x.request.candidates??[]).slice(0,8).map(c=>({field:c.field,value:redactText(String(c.value??'')),confidence:c.confidence,reason:c.reason})),instructions:(x.request.instructions??[]).slice(0,5).map(redactText)}:null,policy:x.policy??{}};
}

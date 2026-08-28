const CLAIM_TYPES=new Set(['fact','inference','recommendation','price','safety','unknown']);
const CLAIM_STATUS=new Set(['supported','partially_supported','unsupported','conflicted','unknown']);

export function normalizeAnswerContract(raw={}){
  return {
    schemaVersion:1,
    answer:typeof raw.answer==='string'?raw.answer.trim():'',
    claims:Array.isArray(raw.claims)?raw.claims.map(normalizeClaim).filter(Boolean):[],
    uncertainty:raw.uncertainty==null?null:String(raw.uncertainty),
    evidenceRefs:Array.isArray(raw.evidenceRefs)?raw.evidenceRefs.filter(x=>typeof x==='string'):[],
    actions:Array.isArray(raw.actions)?raw.actions:[],
    identityProposal:normalizeIdentityProposal(raw.identityProposal),
    epistemic:normalizeEpistemic(raw.epistemic),
  };
}

function normalizeIdentityProposal(p){
  if(!p||typeof p!=='object')return null;
  return {canonicalName:String(p.canonicalName??'').trim(),category:String(p.category??'unknown').trim()||'unknown',brand:p.brand==null?null:String(p.brand).trim(),model:p.model==null?null:String(p.model).trim(),variant:p.variant==null?null:String(p.variant).trim(),region:p.region==null?null:String(p.region).trim(),aliases:Array.isArray(p.aliases)?p.aliases.map(String):[],confidence:clamp01(p.confidence??0),status:String(p.status??'unknown'),evidenceRefs:Array.isArray(p.evidenceRefs)?p.evidenceRefs.filter(x=>typeof x==='string'):[]};
}

function normalizeClaim(c){
  if(!c||typeof c!=='object'||typeof c.text!=='string'||!c.text.trim())return null;
  const type=CLAIM_TYPES.has(c.type)?c.type:'unknown';
  const status=CLAIM_STATUS.has(c.status)?c.status:'unknown';
  return {
    id:String(c.id??crypto.randomUUID()),text:c.text.trim(),type,status,
    confidence:clamp01(c.confidence??0),
    evidenceRefs:Array.isArray(c.evidenceRefs)?c.evidenceRefs.filter(x=>typeof x==='string'):[],
    evidenceKind:c.evidenceKind==null?null:String(c.evidenceKind),
    temporalStatus:c.temporalStatus==null?null:String(c.temporalStatus),
    observedAt:c.observedAt??null,
    provenanceRef:c.provenanceRef??null,
  };
}
function clamp01(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}

function normalizeEpistemic(e){
  if(!e||typeof e!=='object')return null;
  return {
    currentFacts:Array.isArray(e.currentFacts)?e.currentFacts:[],
    historicalFacts:Array.isArray(e.historicalFacts)?e.historicalFacts:[],
    userReports:Array.isArray(e.userReports)?e.userReports:[],
    inferences:Array.isArray(e.inferences)?e.inferences:[],
    conflicts:Array.isArray(e.conflicts)?e.conflicts:[],
    unknowns:Array.isArray(e.unknowns)?e.unknowns:[],
    provenance:Array.isArray(e.provenance)?e.provenance:[],
  };
}

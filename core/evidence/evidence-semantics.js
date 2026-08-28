const KINDS=new Set(['observation','user_report','ocr_extraction','external_source','inference','tool_result','teacher_result']);
const STATES=new Set(['active','superseded','expired','retracted','conflicted']);

export function normalizeEvidenceSemantics(evidence={},defaults={}){
  const now=defaults.now??new Date().toISOString();
  const evidenceKind=normalizeKind(evidence.evidenceKind??defaults.evidenceKind??inferKind(evidence));
  const observedAt=evidence.observedAt??defaults.observedAt??evidence.createdAt??evidence.accessedAt??now;
  const assertedAt=evidence.assertedAt??defaults.assertedAt??evidence.createdAt??now;
  const validUntil=evidence.validUntil??defaults.validUntil??null;
  const lifecycleState=normalizeState(evidence.lifecycleState??defaults.lifecycleState??'active');
  const confidence=clamp(evidence.confidence??defaults.confidence??defaultConfidence(evidenceKind));
  const provenanceRef=evidence.provenanceRef??defaults.provenanceRef??evidence.provenance?.sourceId??null;
  return {
    schemaVersion:1,
    evidenceKind,
    lifecycleState,
    confidence,
    observedAt,
    assertedAt,
    validUntil,
    provenanceRef,
    supersedes:evidence.supersedes??defaults.supersedes??null,
    derivedFrom:[...new Set(evidence.derivedFrom??defaults.derivedFrom??[])],
  };
}

export function withEvidenceSemantics(evidence={},defaults={}){
  return {...evidence,semantics:normalizeEvidenceSemantics(evidence,defaults)};
}

export function assessEvidenceUsability(evidence={},options={}){
  const nowMs=Date.parse(options.now??new Date().toISOString());
  const s=evidence.semantics??normalizeEvidenceSemantics(evidence,options);
  const reasons=[];
  if(['retracted','superseded'].includes(s.lifecycleState))reasons.push(`lifecycle_${s.lifecycleState}`);
  if(s.lifecycleState==='conflicted')reasons.push('lifecycle_conflicted');
  const until=Date.parse(s.validUntil??'');
  if(Number.isFinite(until)&&Number.isFinite(nowMs)&&nowMs>until)reasons.push('validity_expired');
  const min=Number(options.minimumConfidence??0);
  if(s.confidence<min)reasons.push('confidence_below_threshold');
  return {usable:reasons.length===0,reasons,semantics:s};
}

export function supersedeEvidence(previous={},replacement={},meta={}){
  const previousWith={...previous,semantics:{...normalizeEvidenceSemantics(previous),lifecycleState:'superseded'}};
  const replacementWith=withEvidenceSemantics(replacement,{
    ...meta,
    supersedes:previous.id??previous.semantics?.provenanceRef??null,
  });
  return {previous:previousWith,replacement:replacementWith};
}

function inferKind(e){
  if(e.type==='search'||e.url||e.provenance)return 'external_source';
  if(e.source==='photo'||e.photoId)return 'observation';
  if(e.source==='user'||e.userReported===true)return 'user_report';
  if(e.source==='ocr'||e.rule?.toLowerCase?.().includes('ocr'))return 'ocr_extraction';
  if(e.source==='teacher')return 'teacher_result';
  if(e.source==='tool')return 'tool_result';
  return 'inference';
}
function normalizeKind(v){return KINDS.has(v)?v:'inference'}
function normalizeState(v){return STATES.has(v)?v:'active'}
function defaultConfidence(kind){
  return {observation:.8,user_report:.75,ocr_extraction:.7,external_source:.7,inference:.55,tool_result:.8,teacher_result:.65}[kind]??.5;
}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}

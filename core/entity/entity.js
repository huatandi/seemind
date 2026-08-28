function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function uniq(values){return [...new Set((values??[]).map(clean).filter(Boolean))]}
export function createResolvedEntity(input={}){
  const confidence=clamp01(input.confidence??0);
  return {
    schemaVersion:1,
    entityId:input.entityId??crypto.randomUUID(),
    canonicalName:clean(input.canonicalName),
    category:clean(input.category)||'unknown',
    subtype:clean(input.subtype)||null,
    brand:clean(input.brand)||null,
    model:clean(input.model)||null,
    variant:clean(input.variant)||null,
    region:clean(input.region)||null,
    aliases:uniq(input.aliases),
    confidence,
    status:input.status??identityStatus(confidence),
    candidates:(input.candidates??[]).map(c=>({...c,confidence:clamp01(c.confidence??0)})),
    evidenceRefs:uniq(input.evidenceRefs),
    conflicts:uniq(input.conflicts),
    resolutionMethod:input.resolutionMethod??'unknown',
    requiresClarification:Boolean(input.requiresClarification),
  };
}
export function identityStatus(confidence){const c=clamp01(confidence);return c>=.9?'confirmed':c>=.75?'probable':c>=.5?'uncertain':'unresolved'}
export function clamp01(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}

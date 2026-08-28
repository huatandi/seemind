export function entityContextForTeacher(resolution){
  const p=resolution?.primary;
  if(!p)return {status:'unresolved',instruction:'Identity is unresolved. Do not assume brand/model/entity identity.'};
  return {
    status:p.status,
    entityId:p.entityId,
    canonicalName:p.canonicalName,
    category:p.category,
    brand:p.brand,
    model:p.model,
    confidence:p.confidence,
    evidenceRefs:p.evidenceRefs,
    conflicts:p.conflicts,
    requiresClarification:p.requiresClarification,
    instruction:p.requiresClarification?'Treat this identity as a candidate only. Verify it before identity-dependent conclusions.':'Use this resolved identity unless stronger supplied evidence contradicts it.',
  };
}

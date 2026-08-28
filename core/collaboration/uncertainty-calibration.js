/**
 * Calibrates whether Student confidence is supported by the evidence shape.
 * It does not decide routes; it exposes dangerous overconfidence and wasteful
 * underconfidence to downstream answerability / collaboration layers.
 */
export function calibrateStudentUncertainty({confidence=0,known=[],uncertain=[],unknown=[],limitations=[],conflicts=[]}={}){
  const raw=clamp(confidence);
  const conflictCount=conflicts.length+uncertain.filter(x=>/conflict/i.test(String(x.reason??''))).length;
  const unresolvedCount=unknown.length;
  const uncertainCount=uncertain.length;
  const limitationCount=limitations.length;
  let penalty=Math.min(.55, conflictCount*.22 + unresolvedCount*.08 + uncertainCount*.045 + limitationCount*.035);
  const evidenceCount=known.length+uncertainCount+unresolvedCount;
  const support=evidenceCount?known.length/evidenceCount:0;
  if(raw>=.85 && support<.5) penalty=Math.max(penalty,.18);
  const calibrated=clamp(raw-penalty);
  const overconfident=raw>=.80 && (calibrated<.70 || conflictCount>0);
  const underconfident=raw<.70 && support>=.85 && !conflictCount && !unresolvedCount && !limitationCount;
  const state=overconfident?'OVERCONFIDENT_RISK':underconfident?'UNDERCONFIDENT_WASTE':calibrated>=.80?'RELIABLY_CONFIDENT':calibrated<.55?'KNOWS_IT_DOES_NOT_KNOW':'CALIBRATED_UNCERTAINTY';
  return {schemaVersion:1,rawConfidence:raw,calibratedConfidence:calibrated,state,overconfident,underconfident,signals:{known:known.length,uncertain:uncertainCount,unknown:unresolvedCount,conflicts:conflictCount,limitations:limitationCount,supportRatio:round(support),penalty:round(penalty)},policy:{neverIncreaseConfidenceFromCalibration:true,conflictPreventsReliableConfidence:true}};
}
function clamp(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0}
function round(v){return Math.round(v*1000)/1000}

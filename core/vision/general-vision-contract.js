export function createGeneralVisionObservation({providerId='local-general-vision',identity=[],scene=[],regions=[],states=[],relationships=[],anomalies=[],confidence=0,limitations=[]}={}){
  return {
    kind:'general_vision',
    schemaVersion:1,
    providerId,
    confidence:Number(confidence)||0,
    identity:normalizeClaims(identity,'identity'),
    scene:normalizeClaims(scene,'scene'),
    regions:regions.map((x,i)=>normalizeRegion(x,i)),
    states:normalizeClaims(states,'state'),
    relationships:normalizeClaims(relationships,'relationship'),
    anomalies:normalizeClaims(anomalies,'anomaly'),
    limitations:[...limitations],
    policy:{
      claimsNeedConfidence:true,
      absenceIsNotNegativeEvidence:true,
      uncertainIdentityMustRemainCandidate:true,
      anomalyIsObservationNotDiagnosis:true,
    },
  };
}
export function generalVisionToVisualRegions(gv={}){
  return (gv.regions??[]).map(r=>({
    id:r.id,source:gv.providerId??'general-vision',regionType:r.regionType,objectType:r.objectType,
    confidence:r.confidence,bbox:r.bbox,tags:r.tags??[],text:r.text??'',
  }));
}
function normalizeClaims(a,kind){return a.map((x,i)=>typeof x==='string'?{id:`${kind}-${i+1}`,label:x,confidence:0,status:'candidate'}:{id:x.id??`${kind}-${i+1}`,label:x.label??x.value??'',confidence:Number(x.confidence??0),status:x.status??(Number(x.confidence??0)>=.85?'observed':'candidate'),evidenceLevel:x.evidenceLevel??x.level??null,evidence:x.evidence??null})}
function normalizeRegion(r,i){return {id:r.id??`vision-region-${i+1}`,regionType:r.regionType??r.type??'object',objectType:r.objectType??null,confidence:Number(r.confidence??0),bbox:r.bbox??null,tags:[...(r.tags??[])],text:r.text??''}}

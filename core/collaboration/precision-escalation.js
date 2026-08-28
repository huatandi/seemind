/**
 * Converts Student uncertainty into a minimal residual task for a Teacher.
 * This module has no routing authority: it only describes the unresolved slice.
 */
export function buildPrecisionEscalation({observation={},collaboration={},problem={},answerability=null}={}){
  const uncertain=[...(collaboration.uncertain??[])];
  const unknown=[...(collaboration.unknown??[])];
  const limitations=[...(collaboration.limitations??[]),...(observation.limitations??[])].filter(Boolean);
  const conflicts=uncertain.filter(x=>/conflict/i.test(String(x.reason??'')));
  const focus=(collaboration.focus??[]).filter(x=>x?.field||x?.bbox);
  const missingFields=unique(unknown.map(x=>x.field));
  const verifyFields=unique(uncertain.map(x=>x.field));
  const evidenceGap=classifyGap({missingFields,verifyFields,conflicts,limitations,problem});
  const calibration=collaboration.calibration??null;
  const residualOnly=Boolean(missingFields.length||verifyFields.length||limitations.length||answerability?.localConfidence<.7||calibration?.overconfident);
  const target=focus.find(x=>x.bbox)?.bbox??null;
  const candidates=uncertain.filter(x=>x.value!=null).slice(0,8).map(x=>({field:x.field,value:x.value,confidence:x.confidence??0,reason:x.reason??'uncertain'}));
  return {
    schemaVersion:1,residualOnly,evidenceGap,
    unresolved:{missingFields,verifyFields,conflictFields:unique(conflicts.map(x=>x.field))},
    focus:{bbox:target,targets:focus.slice(0,8)},candidates,calibration,
    request:residualOnly?requestFor({evidenceGap,missingFields,verifyFields,candidates}):null,
    policy:{redoReliableWork:false,preserveStudentKnown:true,sendMinimumNecessaryRegion:true,teacherOutputIsCandidate:true,verifyBeforeAccept:true},
  };
}
function classifyGap({missingFields,verifyFields,conflicts,limitations,problem}){
  if(conflicts.length)return 'EVIDENCE_CONFLICT';
  const text=`${missingFields.join(' ')} ${verifyFields.join(' ')} ${limitations.join(' ')} ${problem?.target??''}`.toLowerCase();
  if(/barcode|gtin|ean|upc/.test(text))return 'BARCODE_IDENTITY';
  if(/model|brand|variant|size|型号|品牌|规格|款式/.test(text))return 'EXACT_IDENTITY';
  if(/ocr|text|total|date|merchant|文字|金额|日期|商户/.test(text))return 'TEXT_DETAIL';
  if(/blur|glare|overexpos|crop|模糊|反光|过曝/.test(text))return 'CAPTURE_QUALITY';
  return 'SEMANTIC_OR_VISUAL_RESIDUAL';
}
function requestFor({evidenceGap,missingFields,verifyFields,candidates}){
  const fields=unique([...missingFields,...verifyFields]);
  return {goal:`Resolve only the remaining ${evidenceGap} gap.`,fields,candidates,instructions:[
    'Do not redo or overwrite Student facts already marked reliable.',
    fields.length?`Focus only on: ${fields.join(', ')}.`:'Focus only on the explicitly unresolved visual/semantic detail.',
    candidates.length?'Prefer verification among supplied candidates when evidence supports it.':'Return unknown if supplied evidence cannot resolve the gap.',
    'Return uncertainty explicitly; do not guess.'
  ]};
}
function unique(xs){return [...new Set(xs.filter(Boolean))]}

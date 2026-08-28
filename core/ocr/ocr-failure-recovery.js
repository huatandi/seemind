/**
 * Bounded OCR recovery policy. This does not perform OCR and has no provider
 * authority; it interprets quality + ensemble evidence and recommends the
 * cheapest next step without inventing text.
 */
export function planOcrFailureRecovery({quality={},ensemble=null,receipt={},deviceClass='balanced',attempts=0,userCanRecapture=true}={}){
  const flags=new Set(quality?.flags??[]);
  const scoring=ensemble?.selected?.scoring??{};
  const score=Number(scoring.score??0);
  const critical=Number(scoring.criticalCompleteness??0);
  const conflicts=Number(scoring.conflictedChecks??0);
  const text=String(ensemble?.selected?.normalization?.normalizedText??ensemble?.selected?.ocr?.text??'').trim();
  const engines=(ensemble?.engines??[]).filter(x=>x.status==='ok');
  const actions=[],reasons=[];

  if(!text){reasons.push('NO_TEXT_RECOVERED');actions.push(A('TEXT_FOCUSED_CROP','cheap',{target:'document_or_label'}));}
  if(flags.has('underexposed')||flags.has('low_contrast')){reasons.push('LOW_CONTRAST_OR_DARK');actions.push(A('ALTERNATE_PREPROCESS','cheap',{plan:'contrast_gamma'}));}
  if(flags.has('blurry_or_low_detail')){
    reasons.push('BLUR_OR_LOW_DETAIL');
    if(attempts===0)actions.push(A('ALTERNATE_PREPROCESS','cheap',{plan:'light_sharpen'}));
    if(userCanRecapture)actions.push(A('RECAPTURE','user',{instruction:'文字仍然不够清楚。请靠近一些、稳住手机，让文字占画面更大后重新拍。'}));
  }
  if(flags.has('highlight_clipping')||flags.has('overexposed')){
    reasons.push('GLARE_OR_OVEREXPOSURE');
    if(userCanRecapture)actions.push(A('RECAPTURE','user',{instruction:'图片有反光或过曝。请换个角度避开强光，再拍一次文字区域。'}));
  }
  if(critical<1){reasons.push('CRITICAL_FIELDS_MISSING');actions.push(A('TEXT_FOCUSED_CROP','cheap',{target:'summary_or_decisive_text'}));}
  if(conflicts>0){reasons.push('SEMANTIC_CONFLICT');actions.push(A('VERIFY_WITH_ALTERNATE_ENGINE','bounded',{onlyIfUnusedEngine:true}));}
  if(score>0&&score<72){reasons.push('LOW_EVIDENCE_SCORE');}

  const exhausted=attempts>=2;
  const alternateEngineAvailable=engines.length<2;
  const localUseful=actions.some(x=>x.cost==='cheap')||(alternateEngineAvailable&&actions.some(x=>x.type==='VERIFY_WITH_ALTERNATE_ENGINE'));
  const unresolved=score<82||critical<1||conflicts>0||!text;
  const shouldEscalate=unresolved&&(exhausted||(!userCanRecapture&&!localUseful));
  if(shouldEscalate)actions.push(A('TEACHER','external',{sendPolicy:'minimum_necessary_text_region',preserveUncertainty:true}));

  return {
    schemaVersion:1,
    needed:unresolved,
    score,criticalCompleteness:critical,conflictedChecks:conflicts,
    reasons:[...new Set(reasons)],actions:dedupe(actions),
    nextAction:dedupe(actions)[0]??null,
    shouldEscalate,
    maxRecoveryAttempts:2,
    policy:shouldEscalate?'ESCALATE_UNRESOLVED_OCR_GAP':'BOUNDED_EVIDENCE_RECOVERY_FIRST',
    invariants:{neverGuessMissingText:true,neverOverwriteResolvedFieldFromRecovery:true,teacherReceivesMinimumNecessaryRegion:true},
    deviceClass,
  };
}
function A(type,cost,detail={}){return {type,cost,...detail}}
function dedupe(xs){const s=new Set();return xs.filter(x=>{const k=`${x.type}|${x.plan??x.target??x.instruction??''}`;if(s.has(k))return false;s.add(k);return true})}

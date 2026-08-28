const MONEY_LABELS=[
  ['subtotal',/\bSUB\s*TOTAL\b/i],
  ['tax',/\bIVA\b/i],
  ['discount',/\b(?:DESCUENTO|DESC\.?)\b/i],
  ['total',/(?:^|\s)TOTAL\b/i],
  ['cash',/\b(?:EFECTIVO|USTED\s+PAG[OÓ])\b/i],
  ['change',/\bCAMBIO\b/i],
];

export function buildReceiptIntelligence({lines=[],fields={},checks=[]}={}){
  const candidatePool=buildCandidatePool(lines);
  const relations=buildRelations(fields,checks);
  const totalAssessment=assessTotal(fields.total,relations);
  const quality=assessReceiptQuality(fields,relations);
  return {
    schemaVersion:2,
    candidatePool,
    relations,
    totalAssessment,
    quality,
    policy:{
      noLabelNoTotal:true,
      arithmeticMayValidateButNotInvent:true,
      conflictMayReduceConfidenceButNotRewrite:true,
      lowConfidenceMayRemainUnresolved:true,
    },
  };
}

export function applyEvidenceConfidence(fields,checks=[]){
  const supportedByField=new Map(),conflictedByField=new Map();
  for(const c of checks){
    const keys=relationFields(c.id);
    for(const k of keys){
      if(c.status==='supported')supportedByField.set(k,(supportedByField.get(k)??0)+1);
      if(c.status==='conflicted')conflictedByField.set(k,(conflictedByField.get(k)??0)+1);
    }
  }
  for(const [key,field] of Object.entries(fields)){
    if(!field||field.value==null)continue;
    const supports=supportedByField.get(key)??0,conflicts=conflictedByField.get(key)??0;
    field.evidenceSupportCount=supports;
    field.evidenceConflictCount=conflicts;
    if(supports>0&&!conflicts)field.confidence=Math.min(.99,Math.max(field.confidence??0,.97));
    if(conflicts>0&&!supports)field.confidence=Math.min(field.confidence??.92,.74);
    if(conflicts>0&&supports>0)field.confidence=Math.min(.9,Math.max(.7,field.confidence??.8));
  }
  return fields;
}

export function extractIvaRateEvidence(lines=[]){
  const out=[];
  for(const line of lines){
    const m=line.clean.match(/\bIVA\s+(\d{1,2}(?:[.,]\d+)?)\s*%/i);
    if(!m)continue;
    const rate=Number(m[1].replace(',','.'));
    if(rate>=0&&rate<=35)out.push({rate,lineIndex:line.index,sourceText:line.raw});
  }
  return out;
}

export function buildIvaRateChecks({lines=[],subtotal,tax}={}){
  const rates=extractIvaRateEvidence(lines);
  if(subtotal?.value==null||tax?.value==null||rates.length!==1)return [];
  const expected=Math.round(subtotal.value*(rates[0].rate/100));
  const delta=Math.abs(expected-tax.value);
  return [{
    id:'subtotal-iva-rate-tax',
    status:delta<=2?'supported':'conflicted',
    rate:rates[0].rate,
    expectedMinor:expected,
    actualMinor:tax.value,
    deltaMinor:delta,
  }];
}

function buildCandidatePool(lines){
  const out=[];
  for(const line of lines){
    const amounts=[...(line.moneyCandidates??[])];
    if(!amounts.length)continue;
    const labels=MONEY_LABELS.filter(([,re])=>re.test(line.clean)).map(([id])=>id);
    out.push({
      lineIndex:line.index,
      sourceText:line.raw,
      labels,
      amounts:amounts.map(x=>({raw:x.raw,normalized:x.normalized,minor:x.minor})),
    });
  }
  return out;
}

function buildRelations(fields,checks){
  const out=[...checks.map(x=>({...x}))];
  if(fields.total?.value==null&&fields.cash?.value!=null&&fields.change?.value!=null){
    out.push({
      id:'cash-change-total-candidate',
      status:'candidate_only',
      expectedMinor:fields.cash.value-fields.change.value,
      reason:'Cash minus change can suggest a TOTAL candidate but policy forbids inventing TOTAL without a reliable TOTAL label.',
    });
  }
  if(fields.total?.value==null&&fields.subtotal?.value!=null&&fields.tax?.value!=null){
    out.push({
      id:'subtotal-tax-total-candidate',
      status:'candidate_only',
      expectedMinor:fields.subtotal.value+fields.tax.value-(fields.discount?.value??0),
      reason:'Arithmetic can suggest a TOTAL candidate but cannot create the TOTAL field.',
    });
  }
  return out;
}

function assessTotal(total,relations){
  if(total?.value==null){
    const suggested=[...new Set(relations.filter(x=>x.status==='candidate_only'&&Number.isInteger(x.expectedMinor)).map(x=>x.expectedMinor))];
    return {
      status:'unresolved',
      value:null,
      suggestedCandidates:suggested,
      mayAutoFill:false,
      reason:'No reliable final TOTAL label evidence.',
    };
  }
  const relevant=relations.filter(x=>['cash-change-total','subtotal-tax-total'].includes(x.id));
  const supported=relevant.filter(x=>x.status==='supported').length;
  const conflicted=relevant.filter(x=>x.status==='conflicted').length;
  return {
    status:conflicted&&!supported?'conflicted':supported?'supported':'label_only',
    value:total.value,
    supportedRelations:supported,
    conflictedRelations:conflicted,
    mayAutoFill:false,
  };
}

function assessReceiptQuality(fields,relations){
  const core=['merchant','date','subtotal','tax','total'];
  const resolved=core.filter(k=>fields[k]?.value!=null).length;
  const conflicts=relations.filter(x=>x.status==='conflicted').length;
  const supports=relations.filter(x=>x.status==='supported').length;
  let score=resolved/core.length*.65+Math.min(.25,supports*.1)-Math.min(.35,conflicts*.15);
  score=Math.max(0,Math.min(1,score));
  return {
    score:Math.round(score*100)/100,
    resolvedCoreFields:resolved,
    coreFieldCount:core.length,
    supportedRelations:supports,
    conflictedRelations:conflicts,
    needsReview:conflicts>0||fields.total?.value==null||fields.date?.value==null,
  };
}

function relationFields(id){
  if(id==='cash-change-total')return ['cash','change','total'];
  if(id==='subtotal-tax-total')return ['subtotal','tax','discount','total'];
  if(id==='subtotal-iva-rate-tax')return ['subtotal','tax'];
  return [];
}

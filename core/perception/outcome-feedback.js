export class OutcomeFeedbackStore{
  constructor({storageKey='seemind.runtime-outcomes.v1',storage=null}={}){
    this.storageKey=storageKey;this.storage=storage??safeStorage();this.memory={};
  }
  record({modality,engineId,deviceKey='default',scenarios=[],kind,outcome,meta={}}={}){
    if(!modality||!engineId||!kind||!outcome)return null;
    const all=this.#load(),now=new Date().toISOString(),active=[...new Set(scenarios?.length?scenarios:['ordinary'])];
    const rows=[];
    for(const scenario of active){
      const key=`${deviceKey}|${modality}|${engineId}|${scenario}`;
      const prev=all[key]??blank({deviceKey,modality,engineId,scenario});
      const next=apply(prev,{kind,outcome,meta,at:now});
      all[key]=next;rows.push(next);
    }
    this.#save(all);return rows;
  }
  list({modality=null,engineId=null,deviceKey=null,scenario=null}={}){
    return Object.values(this.#load()).filter(x=>
      (!modality||x.modality===modality)&&(!engineId||x.engineId===engineId)&&
      (!deviceKey||x.deviceKey===deviceKey)&&(!scenario||x.scenario===scenario));
  }
  clear(){this.memory={};try{this.storage?.removeItem?.(this.storageKey)}catch{}}
  #load(){try{return JSON.parse(this.storage?.getItem?.(this.storageKey)||'{}')}catch{return {...this.memory}}}
  #save(v){this.memory={...v};try{this.storage?.setItem?.(this.storageKey,JSON.stringify(v))}catch{}}
}

export function buildOutcomeValidation({rows=[],modality,deviceKey,scenarios=[],minimumTechnical=8,minimumQuality=5,maxAgeDays=30,now=Date.now()}={}){
  const active=[...new Set(scenarios?.length?scenarios:['ordinary'])];
  const filtered=(rows??[]).filter(x=>x.modality===modality&&x.deviceKey===deviceKey&&active.includes(x.scenario)&&fresh(x,maxAgeDays,now));
  const byEngine={};
  for(const row of filtered){
    const e=byEngine[row.engineId]??{engineId:row.engineId,technicalAttempts:0,technicalFailures:0,qualitySignals:0,confirmed:0,corrected:0,scenarioRows:0};
    e.technicalAttempts+=Number(row.technicalAttempts??0);
    e.technicalFailures+=Number(row.technicalFailures??0);
    e.qualitySignals+=Number(row.qualitySignals??0);
    e.confirmed+=Number(row.confirmed??0);
    e.corrected+=Number(row.corrected??0);
    e.scenarioRows++;byEngine[row.engineId]=e;
  }
  const adjustments={};
  for(const e of Object.values(byEngine)){
    let delta=0,reasons=[];
    if(e.technicalAttempts>=minimumTechnical){
      const failureRate=e.technicalFailures/e.technicalAttempts;
      if(failureRate>=.35){delta-=.10;reasons.push('RUNTIME_TECHNICAL_REGRESSION')}
      else if(failureRate>=.2){delta-=.05;reasons.push('RUNTIME_TECHNICAL_WEAKNESS')}
    }
    if(e.qualitySignals>=minimumQuality){
      const correctionRate=e.corrected/e.qualitySignals;
      if(correctionRate>=.4){delta-=.12;reasons.push('USER_CORRECTION_REGRESSION')}
      else if(correctionRate>=.25){delta-=.06;reasons.push('USER_CORRECTION_WEAKNESS')}
      else if(correctionRate<=.1&&e.confirmed>=minimumQuality){delta+=.04;reasons.push('USER_CONFIRMED_STABILITY')}
    }
    adjustments[e.engineId]={delta:clamp(delta,-.16,.06),reasons,stats:e};
  }
  return {
    schemaVersion:1,modality,deviceKey,scenarios:active,adjustments,
    evidenceRows:filtered.length,minimumTechnical,minimumQuality,maxAgeDays,
    principle:'Only attributable runtime outcomes may validate or weaken routing experience. Downstream problem resolution, Search, Teacher or human outcomes are not perception-engine quality signals.',
  };
}

export function outcomeValidationAdjustment({engineId,validation}={}){
  const x=validation?.adjustments?.[engineId];
  return x?{delta:x.delta,reason:x.reasons[0]??'RUNTIME_OUTCOME_NEUTRAL',reasons:x.reasons,stats:x.stats}:{delta:0,reason:'NO_ATTRIBUTABLE_OUTCOME_EVIDENCE',reasons:[]};
}

export function classifyAttribution({event,modality}={}){
  const e=String(event??'');
  if(['engine_completed','engine_failed','engine_timeout'].includes(e))return {attributable:true,scope:'technical_execution',modality};
  if(['transcript_confirmed','transcript_corrected'].includes(e)&&modality==='voice')return {attributable:true,scope:'recognition_quality',modality};
  if(['problem_resolved','problem_unresolved','search_failed','teacher_failed','human_handoff'].includes(e))
    return {attributable:false,scope:'downstream_outcome',modality:null};
  return {attributable:false,scope:'unknown',modality:null};
}

function blank({deviceKey,modality,engineId,scenario}){return {schemaVersion:1,deviceKey,modality,engineId,scenario,technicalAttempts:0,technicalFailures:0,qualitySignals:0,confirmed:0,corrected:0,lastUpdatedAt:null}}
function apply(row,{kind,outcome,meta,at}){
  const next={...row,lastUpdatedAt:at,lastMeta:meta};
  if(kind==='technical'){
    next.technicalAttempts++;
    if(outcome!=='success')next.technicalFailures++;
  }else if(kind==='quality'){
    next.qualitySignals++;
    if(outcome==='confirmed')next.confirmed++;
    if(outcome==='corrected')next.corrected++;
  }
  return next;
}
function fresh(row,maxAgeDays,now){const t=Date.parse(row.lastUpdatedAt??'');return Number.isFinite(t)&&now-t<=maxAgeDays*86400000}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0))}
function safeStorage(){try{return globalThis.localStorage??null}catch{return null}}

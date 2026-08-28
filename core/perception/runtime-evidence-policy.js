import {chooseCanaryEngine} from './lab/canary-policy.js';

export function buildRuntimeEvidencePolicy({labResults=[],modality,deviceKey,language='auto',maxAgeDays=30,minimumCases=12,now=Date.now()}={}){
  const all=(labResults??[]).filter(x=>x.modality===modality&&x.deviceKey===deviceKey);
  const rows=all.filter(x=>isFreshEnough(x,{maxAgeDays,minimumCases,now}));
  const canary=chooseCanaryEngine({labResults:rows,modality,deviceKey});
  const promoted=new Set(rows.filter(x=>x.promotion?.promoted).map(x=>runtimeId(modality,x.engineId)));
  const regressions=new Set(rows.filter(x=>x.meta?.comparison?.verdict==='REGRESSION').map(x=>runtimeId(modality,x.engineId)));
  const preferred=canary.selected?runtimeId(modality,canary.selected):null;
  return {
    schemaVersion:1,modality,deviceKey,language,
    preferredEngineId:preferred,
    promotedEngineIds:[...promoted],
    avoidEngineIds:[...regressions],
    canaryReason:canary.reason,
    evidenceCount:rows.length,
    ignoredEvidenceCount:all.length-rows.length,
    minimumCases,maxAgeDays,
    mode:preferred?'canary_preference':'evidence_only',
    principle:'Lab evidence may bias runtime ranking only after promotion/canary checks. It never bypasses capability, health, privacy, or device-budget gates.',
  };
}

export function runtimeEvidenceAdjustment({engineId,policy}={}){
  if(!policy||!engineId)return {delta:0,reason:'NO_LAB_EVIDENCE'};
  if(policy.avoidEngineIds?.includes(engineId))return {delta:-.22,reason:'LAB_REGRESSION'};
  if(policy.preferredEngineId===engineId)return {delta:.16,reason:'PROMOTED_CANARY'};
  if(policy.promotedEngineIds?.includes(engineId))return {delta:.06,reason:'PROMOTED_ELIGIBLE'};
  return {delta:0,reason:'NO_RUNTIME_PROMOTION'};
}

function runtimeId(modality,id=''){
  if(modality==='vision'&&String(id).startsWith('visual:'))return String(id).slice(7);
  return String(id);
}

function isFreshEnough(row,{maxAgeDays,minimumCases,now}){
  const cases=Number(row?.metrics?.cases??row?.metrics?.runs??0);
  if(cases<minimumCases)return false;
  const t=Date.parse(row?.updatedAt??row?.meta?.updatedAt??'');
  if(!Number.isFinite(t))return false;
  return now-t<=maxAgeDays*86400000;
}

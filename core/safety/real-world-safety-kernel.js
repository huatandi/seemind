export const RISK_LEVELS=Object.freeze({R0:0,R1:1,R2:2,R3:3});

export function assessRealWorldRisk({observation={},problem={},worldDomain={},proposedActions=[]}={}){
  const text=normalize(`${problem.userQuestion??''} ${observation.extractedText??''} ${(problem.symptoms??[]).map(x=>x.sourceText??x.text??'').join(' ')}`);
  const domain=worldDomain.primary??'general';
  let level='R0',reasons=[],hazards=[];
  const raise=(to,reason,hazard=null)=>{if(RISK_LEVELS[to]>RISK_LEVELS[level])level=to;if(reason)reasons.push(reason);if(hazard)hazards.push(hazard)};

  if(['finance','vehicle','food'].includes(domain))raise('R1',`domain:${domain}`);
  if(domain==='repair')raise('R1','repair_action_context');

  if(/裸露电线|触电|高压|配电|电箱|mains|high voltage|electroc|cable pelado/i.test(text))raise('R3','electrical_serious_hazard','electrical');
  if(/冒烟|着火|火焰|燃气|煤气|gas leak|smoke|fire|olor a gas|fuga de gas/i.test(text))raise('R3','fire_or_gas_hazard',/燃气|煤气|gas|fuga/i.test(text)?'gas':'fire');
  if(/中毒|误食|毒蘑菇|poison|overdose|sobredosis|ingest/i.test(text))raise('R3','poisoning_or_ingestion_hazard','poisoning');
  if(/胸痛|呼吸困难|昏迷|大出血|chest pain|difficulty breathing|unconscious|severe bleeding/i.test(text))raise('R3','medical_emergency_signal','medical');
  if(/刹车失灵|制动失灵|轮胎爆|brake failure|flat tire.*highway|freno.*falla/i.test(text))raise('R3','vehicle_immediate_safety_hazard','vehicle');
  if(domain==='animal'&&/毒蛇|蛇咬|蝎|危险动物|venom|snake bite|scorpion/i.test(text))raise('R3','dangerous_animal_hazard','animal');
  if(/药|medicine|medication|dose|dosis|处方|剂量/i.test(text))raise('R2','medical_or_medication_decision','medical');
  if(/能不能吃|可以吃|食用|edible|comer|eat this/i.test(text))raise('R2','ingestion_decision','food');
  if(/混合|混在一起|漂白水|bleach|ammonia|cloro|amon[ií]aco/i.test(text))raise('R3','chemical_mixing_hazard','chemical');
  if(/剪.*线|拆.*电|打开.*配电|bypass|短接|short circuit|拆安全|disable safety/i.test(text))raise('R3','irreversible_hazardous_action','electrical');

  const actions=proposedActions.map(normalizeAction).filter(Boolean);
  for(const a of actions){
    if(a.irreversible&&a.potentialHarm==='severe')raise('R3','proposed_irreversible_severe_action',a.hazard);
    else if(a.potentialHarm==='severe')raise('R2','proposed_severe_harm_action',a.hazard);
  }

  return {
    schemaVersion:1,level,score:RISK_LEVELS[level],reasons:unique(reasons),hazards:unique(hazards),
    allowedInstructionLevel:level==='R3'?'protective_only':level==='R2'?'cautious_non_invasive':level==='R1'?'normal_with_cautions':'normal',
    requiresExpert:level==='R3'||(level==='R2'&&['medical','electrical','vehicle'].some(x=>hazards.includes(x))),
    requiresMoreEvidence:level==='R2',
    commercialDecisionLocked:level==='R3',
  };
}

export function enforceSafety({risk,explanation={},problem={},worldDomain={}}={}){
  const r=risk??assessRealWorldRisk({problem,worldDomain});
  const original=[...(explanation.nextSteps??[])];
  const blocked=[];
  let next=original.filter(step=>{
    const dangerous=isDangerousInstruction(step,r);
    if(dangerous)blocked.push({text:step,reason:'unsafe_action_filtered'});
    return !dangerous;
  });

  let safetyMessage=null,escalation=null;
  if(r.level==='R3'){
    safetyMessage=protectiveMessage(r);
    next=[safetyMessage];
    escalation=buildEscalation(r);
  }else if(r.level==='R2'){
    safetyMessage='这个问题如果判断错误可能造成现实伤害。我可以继续解释和帮助核实，但不会仅凭图片建议不可逆或高风险操作。';
    next=[safetyMessage,...next].slice(0,3);
    escalation=r.requiresExpert?buildEscalation(r):null;
  }else if(r.level==='R1'){
    safetyMessage='可以继续分析；涉及实际操作时，请先确认现场条件与产品/设备说明。';
  }
  return {...explanation,nextSteps:next,safety:{risk:r,message:safetyMessage,blockedActions:blocked,escalation,decisionLockedAt:new Date().toISOString()}};
}

export function buildSafetyAuditRecord({risk,problem={},worldDomain={},safetyResult={}}={}){
  return {
    schemaVersion:1,
    at:new Date().toISOString(),
    domain:worldDomain.primary??'general',
    userQuestion:String(problem.userQuestion??'').slice(0,500),
    riskLevel:risk.level,
    reasons:[...risk.reasons],
    hazards:[...risk.hazards],
    allowedInstructionLevel:risk.allowedInstructionLevel,
    blockedActionCount:safetyResult.safety?.blockedActions?.length??0,
    escalationCategory:safetyResult.safety?.escalation?.category??null,
    commercialDecisionLocked:risk.commercialDecisionLocked,
  };
}

export function commercialHandoff(safetyResult={}){
  const s=safetyResult.safety;
  if(!s?.escalation)return null;
  return {
    schemaVersion:1,
    decisionLocked:true,
    serviceCategory:s.escalation.category,
    reason:s.escalation.reason,
    sponsoredRankingMayChangeSafetyDecision:false,
    mayOfferSponsoredProviders:true,
  };
}

function isDangerousInstruction(text,risk){
  if(risk.level!=='R3')return false;
  return /拆|剪|切|触碰|打开|短接|旁路|继续开|继续驾驶|吃|服用|加量|减量|混合|倒入|repair|cut|touch|open|bypass|drive|eat|take|mix/i.test(String(text));
}
function protectiveMessage(r){
  if(r.hazards.includes('gas')||r.hazards.includes('fire'))return '先远离可能的危险区域，不要尝试拆卸、点火、开关可能产生火花的设备；如存在燃气泄漏、烟雾或火情迹象，请联系当地适当的紧急服务或专业人员。';
  if(r.hazards.includes('electrical'))return '不要触碰、拆开、剪断或短接相关电气部件。先与危险部位保持距离；需要处理时请由合格电工或相应专业人员现场确认。';
  if(r.hazards.includes('medical')||r.hazards.includes('poisoning'))return '这可能涉及紧急健康风险。不要仅依据图片自行进行高风险处置；请尽快联系当地急救/医疗专业人员或毒物相关紧急咨询渠道。';
  if(r.hazards.includes('vehicle'))return '不要在无法确认安全的情况下继续驾驶或进行危险操作；先把人和车辆置于安全位置，并联系合格的道路救援或车辆专业人员。';
  if(r.hazards.includes('animal'))return '保持距离，不要触碰、捕捉或刺激它；如已经发生咬伤、蜇伤或出现严重症状，请尽快联系当地医疗/急救专业人员。';
  if(r.hazards.includes('chemical'))return '不要混合、加热或继续使用这些化学品；先远离暴露源并保持环境安全，必要时联系当地紧急服务或专业人员。';
  return '这里存在潜在严重现实风险。我可以继续帮助识别和解释，但不会仅凭图片指导不可逆或危险操作；请优先采取保护性措施并联系合适的专业人员。';
}
function buildEscalation(r){
 const map={electrical:'electrician',gas:'emergency_or_gas_service',fire:'emergency_service',medical:'medical_professional',poisoning:'poison_control_or_medical',vehicle:'roadside_or_vehicle_professional',animal:'medical_or_animal_control',chemical:'emergency_or_hazmat_professional'};
 const h=r.hazards[0]??'general';
 return {needed:true,category:map[h]??'qualified_professional',reason:r.reasons[0]??'high_real_world_risk',commercialSeparation:true};
}
function normalizeAction(a){if(typeof a==='string')return {text:a,irreversible:false,potentialHarm:null,hazard:null};return a}
function normalize(s){return String(s??'').toLowerCase()}
function unique(a){return [...new Set(a.filter(Boolean))]}

export function buildSpecialistHandoff({intentPlan={},intentGraph={},worldDomain={},problem={},observation={},safety={},availableTeachers=[]}={}){
 const needs=Boolean(intentPlan.shouldRouteExternally||safety?.escalation?.needed);
 if(!needs)return null;
 const category=safety?.escalation?.category??specialistCategory(worldDomain.primary,intentGraph.primary);
 const facts=(problem.knownFacts??[]).slice(0,8).map(x=>x.text??x.value??x.type).filter(Boolean);
 const question=String(problem.userQuestion??intentGraph.userText??'').trim();
 return {
  schemaVersion:1,
  needed:true,
  category,
  reason:safety?.escalation?.needed?'safety_escalation':intentPlan.externalRouteReason??'specialist_advantage',
  userGoal:intentGraph.intents?.map(x=>x.intent)??[intentGraph.primary],
  preparedPrompt:preparePrompt({question,category,facts,domain:worldDomain.primary}),
  evidencePackage:{
    originalQuestion:question,
    structuredFacts:facts,
    extractedText:String(observation.extractedText??'').slice(0,1500),
    sendOriginalImage:shouldSendImage(intentGraph,observation),
    minimumNecessary:true,
  },
  candidates:(availableTeachers??[]).map(normalizeCandidate),
  attributionRequired:true,
  seeMindRole:'orchestrator',
  specialistRole:'analysis_or_execution',
  sourceLabelRequired:true,
 };
}

export function buildReferralPresentation(handoff={}){
 if(!handoff?.needed)return null;
 return {
  title:'交给更合适的 AI / 工具 / 专家',
  why:`这个环节更适合由 ${handoff.category} 继续处理。`,
  whatToSend:handoff.evidencePackage,
  suggestedPrompt:handoff.preparedPrompt,
  attribution:'后续专业结论应标明来源；SeeMind 负责整理、转交和综合，不冒充该专业结论的原始提供者。',
 };
}

function specialistCategory(domain,intent){
 if(intent==='translate')return 'translation_ai_or_tool';
 if(intent==='authenticity')return 'verification_specialist_or_authoritative_source';
 if(intent==='find')return 'search_or_directory';
 const m={plant:'plant_identification_specialist',animal:'animal_identification_specialist',food:'food_information_specialist',document:'document_ai_or_authoritative_source',finance:'finance_specialist',vehicle:'vehicle_specialist',repair:'repair_specialist',place:'maps_search_or_local_expert',product:'product_search_or_brand_source',translation:'translation_ai_or_tool'};
 return m[domain]??'best_capable_ai_tool_or_human';
}
function preparePrompt({question,category,facts,domain}){
 const evidence=facts.length?`\n已确认信息：${facts.join('；')}`:'';
 return `请作为 ${category} 处理这个尚未解决的子问题。领域：${domain}。用户原始诉求：${question||'请根据提供的图片/证据识别并解释用户最可能关心的问题。'}${evidence}\n请区分确定事实、推测和无法确认的部分，并给出下一步。`;
}
function shouldSendImage(intent,o){
 return ['identify','authenticity','diagnose','compare','read'].some(x=>(intent.intents??[]).some(y=>y.intent===x))||String(o.detectedType??'')==='unknown';
}
function normalizeCandidate(x){return {id:x.id??x.providerId??x.name??null,name:x.name??x.id??'Teacher',capabilities:x.capabilities??[],source:'teacher'}}

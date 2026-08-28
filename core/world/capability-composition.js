const INTENT_CAPABILITIES=Object.freeze({
 identify:['perceive','identify'], explain:['explain'], read:['ocr','read_text'], translate:['translate'],
 understand:['interpret'], how_to_use:['usage_guidance'], how_to_do:['procedural_guidance'], diagnose:['cause_analysis'],
 solve:['problem_solving'], compare:['compare'], evaluate:['evaluate'], safety:['safety_assess'], authenticity:['authenticity_check'],
 find:['search','retrieve_current_info'], learn:['teach'], record:['extract_structured_data'], route_to_specialist:['specialist_handoff'],
});
const DOMAIN_CAPABILITIES=Object.freeze({
 document:['document_understanding'], finance:['financial_document_understanding'], food:['food_understanding'],
 plant:['plant_understanding'], animal:['animal_understanding'], vehicle:['vehicle_understanding'], product:['product_understanding'],
 place:['place_understanding'], translation:['language_understanding'], repair:['repair_specialist'], safety:['safety_reasoning'],
 nature:['nature_understanding'], general:['general_world_understanding'], unknown:['general_world_understanding'],
});

export function composeCapabilities({worldDomain={},intentGraph={}}={}){
 const domains=activeDomains(worldDomain);
 const intents=(intentGraph.intents??[]).map(x=>x.intent);
 if(!intents.length&&intentGraph.primary)intents.push(intentGraph.primary);
 const required=[];
 for(const d of domains)required.push(...(DOMAIN_CAPABILITIES[d]??[]));
 for(const i of intents)required.push(...(INTENT_CAPABILITIES[i]??[]));
 const capabilities=[...new Set(required)];
 const external=capabilities.filter(x=>['search','retrieve_current_info','specialist_handoff'].includes(x));
 return {
   schemaVersion:1,
   domains,
   intents:[...new Set(intents)],
   capabilities,
   compound:domains.length>1||intents.length>1,
   externalCapabilities:external,
   principle:'COMPOSE_CAPABILITIES_DO_NOT_FORCE_SINGLE_DOMAIN',
 };
}

function activeDomains(worldDomain){
 const explicit=(worldDomain.active??[]).map(x=>typeof x==='string'?x:x.domain).filter(Boolean);
 if(explicit.length)return [...new Set(explicit)];
 const ranked=[worldDomain.primary,...(worldDomain.secondary??[]).filter(x=>Number(x.confidence)>=.7).map(x=>x.domain)].filter(Boolean);
 return [...new Set(ranked.length?ranked:['general'])];
}

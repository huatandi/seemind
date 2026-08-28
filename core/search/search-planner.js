export function planSearch(taskPackage={}){
  const task=taskPackage.task??{};const freshness=taskPackage.freshness??task.freshness??{};
  if(!(task.webSearchRequired||freshness.required))return {required:false,reason:'freshness_not_required'};
  const identity=taskPackage.entityResolution?.primary??taskPackage.entities?.[0]??null;
  const gate=taskPackage.identity??null;
  if(gate?.required && !gate?.ok)return {required:true,blocked:true,reason:'identity_verification_required',query:null,language:task.language??'auto',locale:task.locale??null,maxResults:5,freshnessClass:freshness.freshnessClass??'FAST_CHANGING',maxAgeMs:freshness.maxAgeMs??null,taskContext:{type:task.type??null,userIntent:String(task.userIntent||taskPackage.userIntent||'').trim()}};
  const intent=String(task.userIntent||taskPackage.userIntent||'').trim();
  if(!intent)return {required:false,reason:'empty_query'};
  const exact=taskPackage.exactProductIdentity??null;
  const identityPrefix=exact?.status==='exact_candidate'&&exact?.searchKey?exact.searchKey:canonicalSearchIdentity(identity);
  const query=identityPrefix?`${identityPrefix} ${intent}`:intent;
  return {required:true,blocked:false,reason:identityPrefix?'canonical_entity_query':'user_intent_query',query,entityId:identity?.entityId??null,canonicalName:identity?.canonicalName??null,language:task.language??'auto',locale:task.locale??null,maxResults:5,freshnessClass:freshness.freshnessClass??'FAST_CHANGING',maxAgeMs:freshness.maxAgeMs??null,taskContext:{type:task.type??null,userIntent:intent}};
}
export function canonicalSearchIdentity(entity){
  if(!entity)return '';
  return [...new Set([entity.brand,entity.model,entity.variant,entity.canonicalName].map(x=>String(x??'').trim()).filter(Boolean))].join(' ');
}

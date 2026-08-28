export function createTask(typeOrInput,userIntent=''){
  const input=typeof typeOrInput==='object'&&typeOrInput!==null?typeOrInput:{type:typeOrInput,userIntent};
  return {
    schemaVersion:1,
    id:input.id??crypto.randomUUID(),
    type:input.type??'general_qa',
    userIntent:input.userIntent??'',
    requiredCapabilities:[...new Set(input.requiredCapabilities??[])],
    optionalCapabilities:input.optionalCapabilities??[],
    riskLevel:input.riskLevel??'low',
    language:input.language??'auto',
    locale:input.locale??null,
    userRegion:input.userRegion??null,
    questionRegion:input.questionRegion??null,
    objectRegion:input.objectRegion??null,
    jurisdiction:input.jurisdiction??null,
    currency:input.currency??null,
    measurementSystem:input.measurementSystem??null,
    timezone:input.timezone??null,
    realtimeRequired:Boolean(input.realtimeRequired),
    webSearchRequired:Boolean(input.webSearchRequired),
    freshness:input.freshness??null,
    createdAt:input.createdAt??new Date().toISOString(),
  };
}

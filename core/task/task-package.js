export function createTaskPackage({task,observation,receipt,userIntent='识别并理解这张票据',conversation=[]}={}){
  return {
    schemaVersion:1,
    task,
    globalContext:task?.globalContext??{
      userRegion:task?.userRegion??null,questionRegion:task?.questionRegion??null,objectRegion:task?.objectRegion??null,
      jurisdiction:task?.jurisdiction??null,language:task?.language??null,locale:task?.locale??null,currency:task?.currency??null,
      measurementSystem:task?.measurementSystem??null,timezone:task?.timezone??null,
    },
    userIntent,
    observations:observation?[sanitizedObservation(observation)]:[],
    conversation:conversation.slice(-8),
    entities:[],
    evidence:receipt?Object.values(receipt).filter(x=>x&&typeof x==='object'&&'field' in x):[],
    constraints:[
      'Do not invent missing fields',
      'Distinguish SUBTOTAL, IVA, TOTAL, EFECTIVO and CAMBIO',
      'Return uncertainty explicitly',
      'Treat Student observations as evidence, not as guaranteed facts',
    ],
    safety:{sensitiveData:true,cloudAllowed:false,userConsent:false,sendPolicy:'minimum_necessary'},
    budget:{maxTeacherCalls:2,maxSearches:3,maxFallbacks:1,maxLatencyMs:30000,maxCloudCost:null},
    freshness:task?.freshness??{required:Boolean(task?.realtimeRequired||task?.webSearchRequired),freshnessClass:task?.realtimeRequired?'LIVE':'STATIC',maxAgeMs:null,reasons:[]},
    outputSchema:task?.type==='question_about_observation'?'grounded_answer_v1':'receipt_understanding_v1',
  };
}
function sanitizedObservation(o){return {schemaVersion:o.schemaVersion,modality:o.modality,detectedType:o.detectedType,extractedText:o.extractedText,confidence:o.confidence,limitations:o.limitations};}

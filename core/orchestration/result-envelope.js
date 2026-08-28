export function createResultEnvelope({route,status='completed',result=null,artifacts=[],taskPackage=null,reason=null,error=null,metrics={},requiresVerification=true}={}){
  return Object.freeze({
    schemaVersion:1,
    kind:'orchestration_result',
    route,
    status,
    result,
    artifacts:[...artifacts],
    taskPackage,
    reason,
    error:error?String(error?.message??error):null,
    metrics:{...metrics},
    requiresVerification:Boolean(requiresVerification),
    completedAt:new Date().toISOString(),
  });
}

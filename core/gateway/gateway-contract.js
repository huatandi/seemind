export function createGatewayRequest({providerId,model,taskPackage,requestId=taskPackage?.execution?.idempotencyKey??crypto.randomUUID()}={}){
  if(!providerId)throw new Error('providerId required');
  if(!taskPackage)throw new Error('taskPackage required');
  return {schemaVersion:1,requestId,providerId,model:model??null,taskPackage};
}
export function validateGatewayResponse(raw,requestId){
  const issues=[];
  if(!raw||typeof raw!=='object')issues.push('gateway_response_not_object');
  if(raw?.requestId&&requestId&&raw.requestId!==requestId)issues.push('gateway_request_mismatch');
  if(!raw?.result||typeof raw.result!=='object')issues.push('gateway_result_missing');
  return {ok:issues.length===0,issues,result:raw?.result??null,meta:raw?.meta??null};
}

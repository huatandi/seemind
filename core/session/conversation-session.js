export function createConversationSession(input={}){
  return {schemaVersion:1,id:input.id??crypto.randomUUID(),observations:input.observations??[],turns:input.turns??[],entityResolution:input.entityResolution??null,factSnapshot:input.factSnapshot??null,createdAt:input.createdAt??new Date().toISOString(),updatedAt:input.updatedAt??new Date().toISOString()};
}
export function attachObservation(session,observation){ session.observations.push(observation); session.updatedAt=new Date().toISOString(); return session; }
export function addTurn(session,{role,text,modality='text'}={}){ session.turns.push({id:crypto.randomUUID(),role,text:String(text||''),modality,createdAt:new Date().toISOString()}); session.updatedAt=new Date().toISOString(); return session; }

export function attachFactSnapshot(session,snapshot){ session.factSnapshot=snapshot??null; session.updatedAt=new Date().toISOString(); return session; }

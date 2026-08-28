export function setVerifiedEntity(session,entity){
  if(!session||!entity)return session;
  session.entityResolution={schemaVersion:1,primary:entity,candidates:[entity],identityConfidence:entity.confidence,conflicts:[],requiresClarification:false,reason:'teacher_verified'};
  session.updatedAt=new Date().toISOString();
  return session;
}
export function getVerifiedEntity(session){return session?.entityResolution?.primary??null;}

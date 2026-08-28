export const VERIFICATION_STATUS=Object.freeze({
 ACCEPT:'ACCEPT',
 ACCEPT_WITH_CAVEAT:'ACCEPT_WITH_CAVEAT',
 NEED_MORE_EVIDENCE:'NEED_MORE_EVIDENCE',
 CONFLICT:'CONFLICT',
 REJECT:'REJECT',
 SAFETY_BLOCK:'SAFETY_BLOCK',
 NOT_REQUIRED:'NOT_REQUIRED',
});

export function createVerificationVerdict({status,reason,route=null,claims=[],issues=[],evidenceSummary=null,safety=null,provenance=[],nextAction=null}={}){
 const accepted=['ACCEPT','ACCEPT_WITH_CAVEAT','NOT_REQUIRED'].includes(status);
 return Object.freeze({
   schemaVersion:1,
   authority:'verification_core',
   status,
   accepted,
   reason,
   route,
   claims:[...claims],
   issues:[...issues],
   evidenceSummary,
   safety,
   provenance:[...provenance],
   nextAction,
   verifiedAt:new Date().toISOString(),
 });
}

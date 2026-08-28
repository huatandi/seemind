import {buildSafeSearchQueries} from './search-privacy-gate.js';

export function prepareExternalSearchRequest({queries=[],task={},worldDomain={},observation={},policy={},consent=false}={}){
 const privacy=buildSafeSearchQueries({queries,task,worldDomain,observation,policy});
 if(!privacy.allowed)return {allowed:false,reason:'NO_SAFE_QUERY',privacy,queries:[]};
 if(privacy.requiresConsent&&!consent&&policy.requireExplicitConsent===true)
   return {allowed:false,reason:'SEARCH_CONSENT_REQUIRED',privacy,queries:[]};
 return {
   allowed:true,
   reason:privacy.requiresConsent?'SENSITIVE_QUERY_MINIMIZED':'QUERY_MINIMIZED',
   privacy,
   queries:privacy.queries,
   consentUsed:Boolean(consent),
 };
}

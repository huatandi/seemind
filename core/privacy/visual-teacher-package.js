import {sanitizeTaskPackage} from './task-package-sanitizer.js';
export function prepareVisualTeacherPackage({taskPackage,answerability,media=[],policy={},consent=false}={}){
 const needsExternal=['TEACHER','SEARCH'].includes(answerability?.decision);
 if(!needsExternal)return {allowed:false,reason:'LOCAL_OR_CLARIFY_PREFERRED',package:null};
 const hasImage=media.some(x=>x?.type==='image');
 if(hasImage&&policy.requireExplicitImageConsent!==false&&!consent)return {allowed:false,reason:'IMAGE_CONSENT_REQUIRED',package:null};
 const base={...taskPackage,media:selectMinimumMedia(media),answerability};
 const sanitized=sanitizeTaskPackage(base,{mode:'minimum_necessary',allowRawText:Boolean(policy.allowRawText),allowImages:hasImage&&consent,includeConversationTurns:policy.includeConversationTurns??3});
 return {allowed:true,reason:hasImage?'MINIMUM_VISUAL_PACKAGE_WITH_CONSENT':'TEXT_EVIDENCE_ONLY',...sanitized};
}
function selectMinimumMedia(media){const roi=media.find(x=>x?.type==='image'&&x?.role==='roi');const context=media.find(x=>x?.type==='image'&&x?.role==='context');return [roi??context??media.find(x=>x?.type==='image')].filter(Boolean)}

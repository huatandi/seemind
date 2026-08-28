export function resolveVoiceTurn({text='',previousUserText='',observation=null}={}){
 const raw=String(text??'').trim(),previous=String(previousUserText??'').trim();
 const correction=parseExplicitCorrection(raw);
 if(correction&&previous){
   const replaced=replaceLast(previous,correction.from,correction.to);
   if(replaced!==previous)return {schemaVersion:1,type:'correction',rawText:raw,resolvedText:replaced,correction,requiresConfirmation:false,policy:'EXPLICIT_CORRECTION_ONLY'};
 }
 const continuation=isContinuation(raw);
 return {schemaVersion:1,type:continuation?'continuation':'new_turn',rawText:raw,resolvedText:raw,correction:null,requiresConfirmation:false,policy:'PRESERVE_VISUAL_CONTEXT_NO_REPERCEPTION'};
}

export function planVoiceFailureRecovery({reason='',attempts=0,hasPartial=false,networkOnline=true,availableFallbacks=0}={}){
 const code=String(reason??'').toLowerCase();
 if(attempts>=2)return {action:'TEXT_OR_TEACHER',retry:false,reason:'BOUNDED_VOICE_RECOVERY_EXHAUSTED'};
 if(/not-allowed|permission|denied/.test(code))return {action:'REQUEST_MIC_PERMISSION',retry:false,reason:'MIC_PERMISSION'};
 if(/network/.test(code)&&!networkOnline)return {action:availableFallbacks?'TRY_LOCAL_FALLBACK':'TEXT_FALLBACK',retry:Boolean(availableFallbacks),reason:'OFFLINE_ASR'};
 if(/timeout|no-speech|audio-capture|network/.test(code))return {action:availableFallbacks?'TRY_FALLBACK':'RETRY_ONCE',retry:true,reason:hasPartial?'PARTIAL_THEN_FAILED':'TECHNICAL_ASR_FAILURE'};
 return {action:availableFallbacks?'TRY_FALLBACK':'RETRY_ONCE',retry:true,reason:'VOICE_ENGINE_FAILURE'};
}
function parseExplicitCorrection(s){
 const patterns=[/(?:不是|不对)[，,\s]*([^，,。；;]+?)[，,\s]*(?:是|应该是)[，,\s]*([^，,。；;]+)$/u,/(?:no|not)\s+(.+?)[,;]?\s+(?:sino|but|it'?s|should be)\s+(.+)$/i,/(?:no es|no era)\s+(.+?)[,;]?\s+(?:es|era)\s+(.+)$/i];
 for(const r of patterns){const m=s.match(r);if(m)return {from:m[1].trim(),to:m[2].trim()}}
 return null;
}
function replaceLast(text,from,to){const i=text.toLowerCase().lastIndexOf(from.toLowerCase());return i<0?text:text.slice(0,i)+to+text.slice(i+from.length)}
function isContinuation(s){return /^(?:继续|然后|还有|那|那么|再|y\b|entonces\b|también\b|also\b|then\b|and\b)/i.test(s)}

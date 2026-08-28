export function planVisionFailureRecovery({quality={},triage={},missingCapabilities=[],deviceProfile={},attempts=0,userCanRecapture=true}={}){
 const flags=new Set(quality?.flags??[]);
 const missing=new Set(missingCapabilities??[]);
 const actions=[],reasons=[];
 const lowBudget=Boolean(deviceProfile?.tier==='low_power'||deviceProfile?.platform?.mobileUnknownMemory);
 const poorQuality=Number(quality?.score??1)<.55;

 if(flags.has('underexposed')||flags.has('low_contrast')){
   actions.push(action('LOCAL_ENHANCE','cheap',{plan:'adaptive_preprocess'}));
   reasons.push('RECOVERABLE_EXPOSURE_OR_CONTRAST');
 }
 if(flags.has('blurry_or_low_detail')){
   if(attempts===0)actions.push(action('LOCAL_ENHANCE','cheap',{plan:'light_sharpen'}));
   if(userCanRecapture)actions.push(action('RECAPTURE','user',{instruction:'请稳住手机并靠近一点重新拍，让目标或文字更大、更清楚。'}));
   reasons.push('BLUR_OR_LOW_DETAIL');
 }
 if(flags.has('highlight_clipping')||flags.has('overexposed')){
   actions.push(action('LOCAL_ENHANCE','cheap',{plan:'highlight_recovery'}));
   if(userCanRecapture)actions.push(action('RECAPTURE','user',{instruction:'请换个角度避开反光或强光，再拍一张。'}));
   reasons.push('HIGHLIGHT_OR_GLARE');
 }
 if(missing.has('specific_identity')||missing.has('visual_grounding')||missing.has('component_parts')){
   actions.push(action('CROP_OR_REGION','cheap',{target:missing.has('specific_identity')?'label_or_nameplate':'referenced_region'}));
   reasons.push('TARGET_REGION_DECISIVE');
 }
 if(missing.has('object_identity')||missing.has('scene_context')){
   if(userCanRecapture)actions.push(action('RECAPTURE','user',{instruction:'请让完整主体进入画面，并保留少量周围环境。'}));
   reasons.push('WHOLE_OBJECT_CONTEXT_MISSING');
 }

 const cheapLocal=actions.some(x=>x.cost==='cheap');
 const shouldEscalate=attempts>=2||(!userCanRecapture&&!cheapLocal)||(poorQuality&&lowBudget&&attempts>=1);
 if(shouldEscalate)actions.push(action('TEACHER','external',{sendPolicy:'minimum_necessary'}));

 return {
   schemaVersion:1,
   needed:actions.length>0,
   reasons:[...new Set(reasons)],
   actions:dedupe(actions),
   nextAction:dedupe(actions)[0]??null,
   shouldEscalate,
   policy:shouldEscalate?'ESCALATE_AFTER_BOUNDED_RECOVERY':'CHEAP_RECOVERY_BEFORE_HEAVY_ESCALATION',
   maxLocalRecoveryAttempts:2,
 };
}
function action(type,cost,detail={}){return {type,cost,...detail}}
function dedupe(a){const s=new Set();return a.filter(x=>{const k=`${x.type}|${x.plan??x.target??x.instruction??''}`;if(s.has(k))return false;s.add(k);return true})}

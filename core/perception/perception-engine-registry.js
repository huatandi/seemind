export class PerceptionEngineRegistry{
 constructor(engines=[]){this.engines=new Map();for(const e of engines)this.register(e)}
 register(engine){
  if(!engine?.id)throw new Error('PERCEPTION_ENGINE_ID_REQUIRED');
  const profile=normalizeProfile(engine.profile??engine.getProfile?.()??{});
  this.engines.set(engine.id,{engine,profile});return this;
 }
 list(){return [...this.engines.values()]}
 candidates({modality,capability,deviceProfile={},language='auto',localOnly=true}={}){
  return this.list().filter(({engine,profile})=>{
   if(profile.modality!==modality&&profile.modality!=='multimodal')return false;
   if(capability&&!profile.capabilities.includes(capability))return false;
   if(localOnly&&profile.local===false)return false;
   if(profile.deviceTiers.length&&!profile.deviceTiers.includes(deviceProfile.tier??'balanced'))return false;
   if(profile.languages.length&&!profile.languages.includes('auto')&&!profile.languages.includes(language))return false;
   try{return engine.isSupported?.()!==false}catch{return false}
  });
 }
}
function normalizeProfile(p){
 return {
  modality:p.modality??'unknown',capabilities:[...(p.capabilities??[])],local:p.local!==false,
  streaming:Boolean(p.streaming),languages:[...(p.languages??['auto'])],deviceTiers:[...(p.deviceTiers??[])],
  estimatedMemoryMb:Number(p.estimatedMemoryMb??0),estimatedLatencyMs:Number(p.estimatedLatencyMs??0),
  qualityClass:p.qualityClass??'unknown',providerFamily:p.providerFamily??null,
 };
}

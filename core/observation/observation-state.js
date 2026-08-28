export function replaceObservationKinds(observation,replacements={}){
  if(!observation||!Array.isArray(observation.observations))return observation;
  const kinds=new Set(Object.keys(replacements));
  observation.observations=observation.observations.filter(x=>!kinds.has(x?.kind));
  for(const [kind,value] of Object.entries(replacements)){
    if(value==null)continue;
    observation.observations.push({kind,...value});
  }
  return observation;
}

export function countObservationKinds(observation={}){
  const out={};
  for(const x of observation.observations??[]){
    const k=x?.kind??'unknown';out[k]=(out[k]??0)+1;
  }
  return out;
}

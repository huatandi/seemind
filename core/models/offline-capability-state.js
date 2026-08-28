export function buildOfflineCapabilityState({online=true,models=[],localCapabilities=[],cachedKnowledge=false,teacherAvailable=true,searchAvailable=true}={}){
  const readyModels=models.filter(x=>x.offlineReady||x.delivery?.ready);
  const modelCaps=new Set(readyModels.flatMap(x=>x.capabilities??[]));
  const local=new Set([...(localCapabilities??[]),...modelCaps]);
  const externalUsable=Boolean(online);
  const unavailable=[];
  if(!externalUsable){
    if(!cachedKnowledge)unavailable.push('fresh_web_knowledge');
    if(!readyModels.length)unavailable.push('optional_heavy_local_models');
  }
  return {
    schemaVersion:1,
    mode:online?'online':'offline',
    localCapabilities:[...local],
    readyModelIds:readyModels.map(x=>x.id),
    cachedKnowledge:Boolean(cachedKnowledge),
    searchAvailable:Boolean(externalUsable&&searchAvailable),
    teacherAvailable:Boolean(externalUsable&&teacherAvailable),
    unavailable,
    policy:online?'LOCAL_FIRST_EXTERNAL_WHEN_NEEDED':'LOCAL_ONLY_STATE_LIMITATIONS_EXPLICITLY',
  };
}

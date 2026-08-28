export function visualProviderAsPerceptionEngine(provider){
  const p=provider?.getProfile?.()??{};
  return {
    id:provider.id,
    profile:{
      modality:'vision',
      capabilities:(p.capabilities??[]).map(x=>x.capability),
      local:(p.privacyModes??[]).includes('local'),
      streaming:false,
      languages:['auto'],
      deviceTiers:p.deviceClasses??[],
      estimatedMemoryMb:p.estimatedMemoryMb??0,
      estimatedLatencyMs:p.estimatedLatencyMs??0,
      qualityClass:qualityClass(p.reliability),
      providerFamily:p.providerType??'visual_provider',
    },
    isSupported:()=>true,
    // Execution remains owned by VisualProviderExecutor; this adapter is for cross-modal catalog/ranking visibility.
    sourceProvider:provider,
  };
}
export function registerVisualProvidersInPerceptionRegistry(registry,providers=[]){
  for(const p of providers??[])registry.register(visualProviderAsPerceptionEngine(p));
  return registry;
}
function qualityClass(r){r=Number(r??0);return r>=.9?'high':r>=.75?'medium':'unknown'}

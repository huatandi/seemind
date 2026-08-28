export class VisualProviderRegistry {
  constructor(providers=[]){this.map=new Map();for(const p of providers)this.register(p)}
  register(provider){
    if(!provider?.id||typeof provider.analyze!=='function')throw new Error('INVALID_VISUAL_PROVIDER');
    if(this.map.has(provider.id))throw new Error(`DUPLICATE_VISUAL_PROVIDER:${provider.id}`);
    this.map.set(provider.id,provider);return provider;
  }
  unregister(id){return this.map.delete(String(id))}
  get(id){return this.map.get(String(id))??null}
  list(){return [...this.map.values()].sort((a,b)=>(b.priority??0)-(a.priority??0)||String(a.id).localeCompare(String(b.id)))}
  profiles(){return this.list().map(p=>p.getProfile?.()??{id:p.id})}
  select({requiredCapabilities=[],deviceClass='balanced',localOnly=true,maxMemoryMb=Infinity}={}){
    return this.list().filter(p=>{
      const profile=p.getProfile?.()??{};
      const caps=profile.capabilities??[];
      const capOk=requiredCapabilities.every(c=>caps.some(x=>x.capability===c));
      const deviceOk=!profile.deviceClasses?.length||profile.deviceClasses.includes(deviceClass);
      const privacyOk=!localOnly||(profile.privacyModes??[]).includes('local');
      const memoryOk=Number(profile.estimatedMemoryMb??0)<=Number(maxMemoryMb);
      return capOk&&deviceOk&&privacyOk&&memoryOk;
    });
  }
}

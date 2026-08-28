export class TeacherRegistry {
  constructor(providers=[]){this.providers=new Map();providers.forEach(p=>this.register(p))}
  register(provider){if(!provider?.id)throw new Error('Teacher provider requires id');this.providers.set(provider.id,provider);return this}
  list(){return [...this.providers.values()]}
  get(id){return this.providers.get(id)??null}
}

export class GatewayTeacherRegistry{
  constructor(entries=[]){this.entries=new Map();entries.forEach(x=>this.register(x));}
  register(entry){if(!entry?.id)throw new Error('gateway teacher id required');this.entries.set(entry.id,{...entry});return this;}
  get(id){return this.entries.get(id)||null;}
  listPublic(){return [...this.entries.values()].map(x=>({
    id:x.id,slot:x.slot,protocol:x.protocol,model:x.model,capabilities:x.capabilities,languages:x.languages,
    reliability:x.reliability,evidenceScore:x.evidenceScore,freshnessScore:x.freshnessScore,latencyClass:x.latencyClass,costClass:x.costClass,
  }));}
}

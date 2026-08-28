export class OcrEngineRegistry{
  constructor(engines=[]){this.map=new Map();for(const e of engines)this.register(e)}
  register(engine){
    if(!engine?.id||typeof engine.recognize!=='function')throw new Error('INVALID_OCR_ENGINE');
    if(this.map.has(engine.id))throw new Error(`DUPLICATE_OCR_ENGINE:${engine.id}`);
    this.map.set(engine.id,engine);return engine;
  }
  unregister(id){return this.map.delete(String(id))}
  get(id){return this.map.get(String(id))??null}
  list(){return [...this.map.values()].sort((a,b)=>(b.priority??0)-(a.priority??0)||String(a.id).localeCompare(String(b.id)))}
  profiles(){return this.list().map(e=>typeof e.publicProfile==='function'?e.publicProfile():({id:e.id}))}
  select({language=null,requiredCapabilities=[]}={}){
    return this.list().filter(e=>{
      const langOk=!language||!e.languages?.length||e.languages.some(x=>language.split('+').includes(x)||x===language);
      const capsOk=requiredCapabilities.every(k=>Boolean(e.capabilities?.[k]));
      return langOk&&capsOk;
    });
  }
}

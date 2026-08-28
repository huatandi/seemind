export class VoiceEngineRegistry{
  constructor(engines=[]){this.engines=new Map();for(const e of engines)this.register(e)}
  register(engine){
    if(!engine?.id)throw new Error('VOICE_ENGINE_ID_REQUIRED');
    this.engines.set(engine.id,engine);return this;
  }
  list(){return [...this.engines.values()]}
  supported(){return this.list().filter(e=>{try{return e.isSupported?.()!==false}catch{return false}})}
}

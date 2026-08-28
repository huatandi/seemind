export class PerceptionEngineAdapter{
  constructor({id,profile={},load=null,infer=null,dispose=null,isSupported=null}={}){
    if(!id)throw new Error('PERCEPTION_ENGINE_ID_REQUIRED');
    if(typeof infer!=='function')throw new Error('PERCEPTION_ENGINE_INFER_REQUIRED');
    this.id=id;this.profile={...profile};this._load=load;this._infer=infer;this._dispose=dispose;this._supported=isSupported;
    this.state={loaded:false,loading:null,lastError:null};
  }
  isSupported(){try{return this._supported?this._supported():true}catch{return false}}
  async ensureLoaded(){
    if(this.state.loaded)return {loaded:true,loadMs:0};
    if(this.state.loading)return this.state.loading;
    const started=performanceNow();
    this.state.loading=(async()=>{
      try{await this._load?.();this.state.loaded=true;this.state.lastError=null;return {loaded:true,loadMs:performanceNow()-started}}
      catch(error){this.state.lastError=error;throw error}
      finally{this.state.loading=null}
    })();
    return this.state.loading;
  }
  async infer(input,options={}){
    const load=await this.ensureLoaded();
    const started=performanceNow();
    const result=await this._infer(input,options);
    return {result,loadMs:load.loadMs,inferenceMs:performanceNow()-started};
  }
  async dispose(){await this._dispose?.();this.state.loaded=false;this.state.loading=null}
}
function performanceNow(){return globalThis.performance?.now?.()??Date.now()}

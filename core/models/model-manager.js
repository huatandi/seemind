import {ModelDeliveryManager} from './model-delivery-manager.js';
import {CacheStorageModelStore} from './model-store.js';
import {ModelAssetStore} from './model-asset-store.js';

export class ModelManager {
  constructor({catalog=[],deliveryManager=null,preferenceStore=null}={}){
    this.catalog=catalog;
    this.preferenceStore=preferenceStore??safeLocalPreferences();
    const metadataStore=new CacheStorageModelStore();
    this.deliveryManager=deliveryManager??new ModelDeliveryManager({
      store:metadataStore,
      assetStore:new ModelAssetStore({metadataStore}),
    });
    this.listeners=new Set();
    this.progress=new Map();
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  emit(event){for(const fn of this.listeners)try{fn(event)}catch{}}
  list(){return this.catalog.map(x=>({...x}))}
  get(id){return this.catalog.find(x=>x.id===id)??null}
  async status(id){
    const item=this.get(id);if(!item)throw new Error(`UNKNOWN_MODEL:${id}`);
    const delivery=await this.deliveryManager.status(item.manifest);
    const estimate=await this.deliveryManager.estimateStorage().catch(()=>({usage:null,quota:null}));
    const pref=this.preferenceStore.get(id);
    const p=this.progress.get(id)??null;
    return {
      id:item.id,name:item.name,description:item.description,estimatedDownloadBytes:item.estimatedDownloadBytes,
      version:item.manifest.version,delivery,storage:estimate,preference:pref,progress:p,
      state:p?.state??(delivery.ready?'ready':'not_installed'),
      offlineReady:Boolean(delivery.ready),
      canInstall:!delivery.ready,
      canRemove:delivery.cachedFiles>0,
    };
  }
  async install(id,{maxBytes=Infinity,reserveBytes=16*1024*1024}={}){
    const item=this.get(id);if(!item)throw new Error(`UNKNOWN_MODEL:${id}`);
    const preflight=await this.deliveryManager.storagePreflight?.(item.manifest,{reserveBytes});
    if(preflight?.canFit===false)throw Object.assign(new Error('MODEL_STORAGE_INSUFFICIENT'),{code:'MODEL_STORAGE_INSUFFICIENT',preflight});
    this.preferenceStore.set(id,{approved:true,installedVersion:item.manifest.version,updatedAt:new Date().toISOString()});
    this.progress.set(id,{state:'downloading',loaded:0,total:item.estimatedDownloadBytes??null});
    this.emit({type:'model_state',id,state:'downloading'});
    try{
      const result=await this.deliveryManager.ensure(item.manifest,{
        maxBytes,onProgress:e=>{
          const current=this.progress.get(id)??{state:'downloading',loaded:0,total:item.estimatedDownloadBytes??null};
          if(e.type==='model_file_progress')current.loaded=aggregateProgress(current,e);
          current.total=item.estimatedDownloadBytes??e.total??current.total;
          current.state=e.type==='model_file_failed'?'retrying':'downloading';
          this.progress.set(id,current);this.emit({type:'model_progress',id,event:e,progress:{...current}});
        }
      });
      this.progress.set(id,{state:'ready',loaded:result.downloadedBytes,total:item.estimatedDownloadBytes??result.downloadedBytes});
      this.emit({type:'model_state',id,state:'ready'});
      return result;
    }catch(error){
      this.progress.set(id,{state:'failed',loaded:0,total:item.estimatedDownloadBytes??null,errorCode:String(error?.code??error?.message??'MODEL_INSTALL_FAILED')});
      this.emit({type:'model_state',id,state:'failed',error});
      throw error;
    }
  }
  async remove(id){
    const item=this.get(id);if(!item)throw new Error(`UNKNOWN_MODEL:${id}`);
    const result=await this.deliveryManager.remove(item.manifest);
    this.preferenceStore.set(id,{approved:false,installedVersion:null,updatedAt:new Date().toISOString()});
    this.progress.delete(id);this.emit({type:'model_state',id,state:'not_installed'});return result;
  }
  isApproved(id){return Boolean(this.preferenceStore.get(id)?.approved)}
  async isReady(id){return (await this.status(id)).offlineReady}
  async audit(id,{repair=false}={}){
    const item=this.get(id);if(!item)throw new Error(`UNKNOWN_MODEL:${id}`);
    const result=await this.deliveryManager.audit(item.manifest,{repair});
    if(!result.healthy){this.progress.set(id,{state:'needs_repair',loaded:0,total:item.estimatedDownloadBytes??null});this.emit({type:'model_state',id,state:'needs_repair'});}
    return result;
  }
}
function aggregateProgress(current,e){
  if(!Number.isFinite(Number(e.loaded)))return current.loaded??0;
  // UI progress is approximate across multiple files; completed model bytes dominate.
  return Math.max(Number(current.loaded??0),Number(e.loaded));
}
function safeLocalPreferences(){
  const key='seemind.model-preferences.v1',memory=new Map();
  const load=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return Object.fromEntries(memory)}};
  const save=x=>{try{localStorage.setItem(key,JSON.stringify(x))}catch{memory.clear();for(const [k,v] of Object.entries(x))memory.set(k,v)}};
  return {get(id){return load()[id]??{}},set(id,v){const x=load();x[id]=v;save(x)}};
}

import {modelCacheKey,validateManifest} from './model-manifest.js';
import {verifyIntegrity} from './model-integrity.js';
import {CacheStorageModelStore} from './model-store.js';

export class ModelDeliveryManager {
  constructor({store=new CacheStorageModelStore(),assetStore=null,fetchImpl=globalThis.fetch,online=()=>globalThis.navigator?.onLine!==false}={}){
    this.store=store;this.assetStore=assetStore;this.fetchImpl=fetchImpl;this.online=online;
  }

  async status(manifest){
    const m=assertManifest(manifest),files=[];
    for(const f of m.files){
      const key=modelCacheKey(m,f),cached=await this.store.has(key),meta=await this.store.metadata(key);
      files.push({path:f.path,key,cached,verified:Boolean(meta?.verified),bytes:meta?.bytes??f.bytes??null,version:m.version});
    }
    const required=files.filter((x,i)=>!m.files[i].optional);
    return {
      modelId:m.id,version:m.version,
      ready:required.every(x=>x.cached&&x.verified),
      cachedFiles:files.filter(x=>x.cached).length,
      totalFiles:files.length,files,
    };
  }

  async ensure(manifest,{offlineOnly=false,maxBytes=Infinity,retries=2,onProgress,signal}={}){
    const m=assertManifest(manifest);
    const before=await this.status(m);
    if(before.ready)return {...before,reused:true,downloadedBytes:0};
    const requiredBytes=m.files.filter((f,i)=>!before.files[i].cached).reduce((s,f)=>s+(f.bytes??0),0);
    if(requiredBytes>maxBytes)throw codeError('MODEL_STORAGE_BUDGET_EXCEEDED');
    if(offlineOnly||!this.online())throw codeError('MODEL_NOT_AVAILABLE_OFFLINE');
    if(typeof this.fetchImpl!=='function')throw codeError('MODEL_FETCH_UNAVAILABLE');

    let downloadedBytes=0,completed=before.cachedFiles;
    for(const file of m.files){
      const key=modelCacheKey(m,file);
      if(await this.store.has(key)){
        const meta=await this.store.metadata(key);
        if(meta?.verified){continue}
      }
      let lastError=null;
      for(let attempt=0;attempt<=retries;attempt++){
        try{
          onProgress?.({type:'model_file_start',modelId:m.id,version:m.version,path:file.path,attempt,totalFiles:m.files.length,completedFiles:completed});
          const bytes=await this.#download(file,{signal,onProgress:(loaded,total)=>onProgress?.({
            type:'model_file_progress',modelId:m.id,path:file.path,loaded,total:total??file.bytes??null,attempt
          })});
          const check=await verifyIntegrity(bytes,file.integrity);
          if(!check.ok)throw codeError('MODEL_INTEGRITY_MISMATCH');
          await this.store.put(key,bytes,{modelId:m.id,version:m.version,path:file.path,verified:true,integrity:file.integrity,bytes:bytes.byteLength,url:file.url});
          await this.assetStore?.putByUrl?.(file.url,bytes,{modelId:m.id,version:m.version,path:file.path,verified:true,integrity:file.integrity});
          downloadedBytes+=bytes.byteLength;completed++;
          onProgress?.({type:'model_file_complete',modelId:m.id,path:file.path,bytes:bytes.byteLength,totalFiles:m.files.length,completedFiles:completed});
          lastError=null;break;
        }catch(error){
          lastError=error;
          await this.store.delete(key).catch(()=>{});
          onProgress?.({type:'model_file_failed',modelId:m.id,path:file.path,attempt,errorCode:safeCode(error)});
          if(attempt>=retries)break;
        }
      }
      if(lastError){
        if(file.optional)continue;
        throw lastError;
      }
    }
    const after=await this.status(m);
    if(!after.ready)throw codeError('MODEL_DELIVERY_INCOMPLETE');
    return {...after,reused:false,downloadedBytes};
  }

  async remove(manifest){
    const m=assertManifest(manifest);let removed=0;
    for(const f of m.files){
      const primary=await this.store.delete(modelCacheKey(m,f));
      await this.assetStore?.deleteByUrl?.(f.url).catch?.(()=>{});
      if(primary)removed++;
    }
    return {modelId:m.id,version:m.version,removed};
  }

  async removeOtherVersions(manifest,{prefix=null}={}){
    const m=assertManifest(manifest),keys=await this.store.keys(),keepPrefix=`${m.id}@${m.version}/`,modelPrefix=prefix??`${m.id}@`;
    let removed=0;
    for(const k of keys)if(k.startsWith(modelPrefix)&&!k.startsWith(keepPrefix)){if(await this.store.delete(k))removed++}
    return {modelId:m.id,version:m.version,removed};
  }

  async estimateStorage(){return this.store.estimate()}

  async audit(manifest,{repair=false}={}){
    const m=assertManifest(manifest),files=[];
    for(const file of m.files){
      const key=modelCacheKey(m,file),cached=await this.store.has(key);
      if(!cached){files.push({path:file.path,key,cached:false,healthy:Boolean(file.optional),reason:'MISSING'});continue}
      const bytes=await this.store.get(key);
      if(!bytes){files.push({path:file.path,key,cached:true,healthy:false,reason:'UNREADABLE'});if(repair)await this.store.delete(key).catch(()=>{});continue}
      const check=await verifyIntegrity(bytes,file.integrity);
      const healthy=Boolean(check.ok);
      files.push({path:file.path,key,cached:true,healthy,reason:healthy?'VERIFIED':'INTEGRITY_MISMATCH',bytes:bytes.byteLength});
      if(!healthy&&repair)await this.store.delete(key).catch(()=>{});
    }
    const required=files.filter((x,i)=>!m.files[i].optional);
    return {modelId:m.id,version:m.version,healthy:required.every(x=>x.healthy),files,repaired:Boolean(repair)};
  }

  async storagePreflight(manifest,{reserveBytes=16*1024*1024}={}){
    const m=assertManifest(manifest),status=await this.status(m),estimate=await this.estimateStorage().catch(()=>({usage:null,quota:null}));
    const needed=m.files.reduce((s,f,i)=>s+(status.files[i]?.cached?0:Number(f.bytes??0)),0);
    const usage=Number(estimate?.usage),quota=Number(estimate?.quota);
    const available=Number.isFinite(usage)&&Number.isFinite(quota)?Math.max(0,quota-usage):null;
    return {neededBytes:needed,availableBytes:available,reserveBytes,canFit:available==null?null:available>=needed+reserveBytes};
  }

  async #download(file,{signal,onProgress}={}){
    const response=await this.fetchImpl(file.url,{signal,cache:'no-store'});
    if(!response?.ok)throw codeError(`MODEL_HTTP_${response?.status??'ERROR'}`);
    const total=Number(response.headers?.get?.('content-length')??file.bytes??0)||null;
    if(!response.body?.getReader){
      const bytes=new Uint8Array(await response.arrayBuffer());onProgress?.(bytes.byteLength,total);return bytes;
    }
    const reader=response.body.getReader(),chunks=[];let loaded=0;
    while(true){
      const {done,value}=await reader.read();if(done)break;
      chunks.push(value);loaded+=value.byteLength;onProgress?.(loaded,total);
    }
    const out=new Uint8Array(loaded);let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength}return out;
  }
}

function assertManifest(m){const x=validateManifest(m);if(!x.valid)throw new Error(x.errors.join(';'));return x.manifest}
function codeError(code){return Object.assign(new Error(code),{code})}
function safeCode(error){return String(error?.code??error?.message??'MODEL_DELIVERY_FAILED').replace(/[^A-Z0-9_:-]/gi,'_').slice(0,80)}

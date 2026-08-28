export class ModelAssetStore {
  constructor({cacheName='seemind-model-assets-v1',metadataStore=null}={}){
    this.cacheName=cacheName;
    this.metadataStore=metadataStore;
    this.memory=new Map();
  }
  async putByUrl(url,bytes,metadata={}){
    const data=toUint8(bytes);
    if(globalThis.caches?.open){
      const cache=await caches.open(this.cacheName);
      await cache.put(String(url),new Response(data));
    }else this.memory.set(String(url),data);
    await this.metadataStore?.put?.(`asset-meta:${url}`,new TextEncoder().encode(JSON.stringify({...metadata,bytes:data.byteLength})),{kind:'asset-metadata'});
  }
  async getByUrl(url){
    if(globalThis.caches?.open){
      const cache=await caches.open(this.cacheName),r=await cache.match(String(url));
      return r?new Uint8Array(await r.arrayBuffer()):null;
    }
    return this.memory.get(String(url))??null;
  }
  async hasByUrl(url){return Boolean(await this.getByUrl(url))}
  async deleteByUrl(url){
    if(globalThis.caches?.open){const cache=await caches.open(this.cacheName);return cache.delete(String(url))}
    return this.memory.delete(String(url));
  }
}
export async function registerModelCacheServiceWorker({url=null,scope=null}={}){
  if(!globalThis.navigator?.serviceWorker?.register)return {supported:false,registered:false};
  const base=globalThis.document?.baseURI??globalThis.location?.href??'https://seemind.local/';
  const resolvedUrl=url??new URL('model-cache-sw.js',base).toString();
  const resolvedScope=scope??new URL('.',base).pathname;
  const registration=await navigator.serviceWorker.register(resolvedUrl,{scope:resolvedScope});
  return {supported:true,registered:true,scope:registration.scope,url:resolvedUrl};
}
function toUint8(v){if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);throw new Error('MODEL_ASSET_BINARY_REQUIRED')}

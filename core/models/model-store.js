export class MemoryModelStore {
  constructor(){this.map=new Map();this.meta=new Map()}
  async has(key){return this.map.has(String(key))}
  async get(key){return this.map.get(String(key))??null}
  async put(key,value,metadata={}){this.map.set(String(key),value);this.meta.set(String(key),{...metadata,updatedAt:new Date().toISOString()})}
  async delete(key){this.meta.delete(String(key));return this.map.delete(String(key))}
  async keys(){return [...this.map.keys()]}
  async metadata(key){return this.meta.get(String(key))??null}
  async estimate(){let usage=0;for(const v of this.map.values())usage+=byteLength(v);return {usage,quota:Infinity}}
  async clear(){this.map.clear();this.meta.clear()}
}

export class CacheStorageModelStore {
  constructor({cacheName='seemind-models-v1'}={}){
    this.cacheName=cacheName;
    this.metaKey='__seemind_model_meta__';
    this.fallback=new MemoryModelStore();
  }
  async #cache(){if(!globalThis.caches?.open)return null;return globalThis.caches.open(this.cacheName)}
  #request(key){return new Request(`https://seemind.local/model-cache/${encodeURIComponent(String(key))}`)}
  async has(key){const c=await this.#cache();if(!c)return this.fallback.has(key);return Boolean(await c.match(this.#request(key)))}
  async get(key){const c=await this.#cache();if(!c)return this.fallback.get(key);const r=await c.match(this.#request(key));return r?new Uint8Array(await r.arrayBuffer()):null}
  async put(key,value,metadata={}){
    const c=await this.#cache();if(!c)return this.fallback.put(key,value,metadata);
    const bytes=toUint8(value);await c.put(this.#request(key),new Response(bytes));
    await this.#writeMeta(key,{...metadata,bytes:bytes.byteLength,updatedAt:new Date().toISOString()});
  }
  async delete(key){const c=await this.#cache();if(!c)return this.fallback.delete(key);await this.#deleteMeta(key);return c.delete(this.#request(key))}
  async keys(){
    const c=await this.#cache();if(!c)return this.fallback.keys();
    const reqs=await c.keys();return reqs.map(r=>decodeURIComponent(r.url.split('/').pop())).filter(x=>x!==this.metaKey);
  }
  async metadata(key){const all=await this.#readMeta();return all[String(key)]??null}
  async estimate(){
    if(globalThis.navigator?.storage?.estimate)return globalThis.navigator.storage.estimate();
    const keys=await this.keys();let usage=0;for(const k of keys){const m=await this.metadata(k);usage+=Number(m?.bytes??0)}return {usage,quota:null};
  }
  async clear(){const keys=await this.keys();for(const k of keys)await this.delete(k)}
  async #readMeta(){
    try{
      const c=await this.#cache();if(!c)return {};
      const r=await c.match(this.#request(this.metaKey));return r?await r.json():{};
    }catch{return {}}
  }
  async #writeMeta(key,value){const c=await this.#cache();if(!c)return;const all=await this.#readMeta();all[String(key)]=value;await c.put(this.#request(this.metaKey),new Response(JSON.stringify(all),{headers:{'content-type':'application/json'}}))}
  async #deleteMeta(key){const c=await this.#cache();if(!c)return;const all=await this.#readMeta();delete all[String(key)];await c.put(this.#request(this.metaKey),new Response(JSON.stringify(all),{headers:{'content-type':'application/json'}}))}
}
function toUint8(v){if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);throw new Error('MODEL_STORE_BINARY_REQUIRED')}
function byteLength(v){try{return toUint8(v).byteLength}catch{return 0}}

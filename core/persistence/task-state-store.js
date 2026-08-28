const DEFAULT_PREFIX='seemind.task.';

export class MemoryTaskStateStore{
  constructor(){this.map=new Map()}
  async save(key,value){this.map.set(String(key),structuredCloneSafe(value));return value}
  async load(key){const v=this.map.get(String(key));return v==null?null:structuredCloneSafe(v)}
  async remove(key){this.map.delete(String(key))}
  async list(){return [...this.map.entries()].map(([key,value])=>({key,value:structuredCloneSafe(value)}))}
}

export class LocalStorageTaskStateStore{
  constructor({storage=globalThis.localStorage,prefix=DEFAULT_PREFIX}={}){if(!storage)throw new Error('LOCAL_STORAGE_UNAVAILABLE');this.storage=storage;this.prefix=prefix}
  storageKey(key){return `${this.prefix}${String(key)}`}
  async save(key,value){this.storage.setItem(this.storageKey(key),JSON.stringify(value));return value}
  async load(key){const raw=this.storage.getItem(this.storageKey(key));if(!raw)return null;try{return JSON.parse(raw)}catch{return null}}
  async remove(key){this.storage.removeItem(this.storageKey(key))}
  async list(){const out=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(!k?.startsWith(this.prefix))continue;const raw=this.storage.getItem(k);try{out.push({key:k.slice(this.prefix.length),value:JSON.parse(raw)})}catch{}}return out}
}

function structuredCloneSafe(value){return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}

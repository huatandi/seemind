export class IdempotencyCache{
  constructor({ttlMs=10*60*1000,maxEntries=1000,now=()=>Date.now()}={}){this.ttlMs=ttlMs;this.maxEntries=maxEntries;this.now=now;this.map=new Map()}
  get(key){this.sweep();const v=this.map.get(String(key));return v?.value??null}
  set(key,value){this.sweep();if(this.map.size>=this.maxEntries)this.map.delete(this.map.keys().next().value);this.map.set(String(key),{value,expiresAt:this.now()+this.ttlMs});return value}
  sweep(){const t=this.now();for(const [k,v] of this.map)if(v.expiresAt<=t)this.map.delete(k)}
}

const DEFAULT_PREFIX='seemind.audit.';
const SENSITIVE_KEY=/api.?key|secret|token|password|credential|authorization|cookie|sessioncookie|dataurl|base64|media|imageblob|rawtext|extractedtext|conversation|payload/i;
const TEXT_KEY=/answer|question|prompt|content|message|userintent|query/i;

export function createAuditEvent(type,data={},meta={}){
  const at=meta.at??new Date().toISOString();
  return {schemaVersion:1,id:meta.id??randomId(),type:String(type).slice(0,80),at,executionId:cleanId(meta.executionId??data.executionId),taskId:cleanId(meta.taskId??data.taskId),data:sanitizeAuditData(data)};
}

export function sanitizeAuditData(value,key='',depth=0){
  if(depth>6)return '[depth-limited]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string'){
    if(/^data:/i.test(value))return {redacted:true,kind:'data_url',length:value.length};
    if(SENSITIVE_KEY.test(key)||TEXT_KEY.test(key))return {redacted:true,kind:'text',length:value.length,hash:hashText(value)};
    return value.length>500?`${value.slice(0,500)}…`:value;
  }
  if(typeof value==='function'||typeof value==='symbol')return undefined;
  if(Array.isArray(value))return value.slice(0,50).map(v=>sanitizeAuditData(v,key,depth+1)).filter(v=>v!==undefined);
  if(typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value)){
      if(SENSITIVE_KEY.test(k)){out[k]={redacted:true,kind:'sensitive_field'};continue}
      const safe=sanitizeAuditData(v,k,depth+1);if(safe!==undefined)out[k]=safe;
    }
    return out;
  }
  return String(value);
}

export class MemoryAuditEventStore{
  constructor(){this.events=[]}
  append(event){this.events.push(clone(event));return event}
  list({executionId=null,taskId=null,limit=500}={}){return this.events.filter(e=>(!executionId||e.executionId===executionId)&&(!taskId||e.taskId===taskId)).slice(-limit).map(clone)}
  clear({executionId=null}={}){this.events=executionId?this.events.filter(e=>e.executionId!==executionId):[]}
}

export class LocalStorageAuditEventStore{
  constructor({storage=globalThis.localStorage,prefix=DEFAULT_PREFIX,maxEvents=1000}={}){if(!storage)throw new Error('LOCAL_STORAGE_UNAVAILABLE');this.storage=storage;this.prefix=prefix;this.maxEvents=maxEvents}
  _key(executionId='global'){return `${this.prefix}${executionId||'global'}`}
  append(event){const key=this._key(event.executionId);const arr=this._read(key);arr.push(event);this.storage.setItem(key,JSON.stringify(arr.slice(-this.maxEvents)));return event}
  list({executionId=null,taskId=null,limit=500}={}){
    let all=[];
    if(executionId)all=this._read(this._key(executionId));else for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(this.prefix))all.push(...this._read(k))}
    return all.filter(e=>!taskId||e.taskId===taskId).sort((a,b)=>String(a.at).localeCompare(String(b.at))).slice(-limit);
  }
  clear({executionId=null}={}){if(executionId){this.storage.removeItem(this._key(executionId));return}const keys=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(this.prefix))keys.push(k)}for(const k of keys)this.storage.removeItem(k)}
  _read(key){try{return JSON.parse(this.storage.getItem(key)||'[]')}catch{return []}}
}

export class DurableAuditLog{
  constructor({store=new MemoryAuditEventStore(),executionId=null,taskId=null}={}){this.store=store;this.executionId=executionId;this.taskId=taskId}
  child(meta={}){return new DurableAuditLog({store:this.store,executionId:meta.executionId??this.executionId,taskId:meta.taskId??this.taskId})}
  record(type,data={}){const event=createAuditEvent(type,data,{executionId:data.executionId??this.executionId,taskId:data.taskId??this.taskId});this.store.append(event);return event}
  list(options={}){return this.store.list({executionId:options.executionId??this.executionId,taskId:options.taskId??this.taskId,limit:options.limit})}
}

function cleanId(v){return v==null?null:String(v).slice(0,160)}
function randomId(){return globalThis.crypto?.randomUUID?.()??`audit-${Date.now()}-${Math.random().toString(36).slice(2)}`}
function clone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}
function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

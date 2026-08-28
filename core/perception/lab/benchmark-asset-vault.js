export class BenchmarkAssetVault{
 constructor({dbName='seemind-benchmark-assets',storeName='assets',version=1}={}){
  this.dbName=dbName;this.storeName=storeName;this.version=version;this.memory=new Map();this.dbPromise=null;
 }
 async put(file,{id=null,kind=null,meta={}}={}){
  if(!file)throw codeError('ASSET_REQUIRED');
  const assetId=id??await assetIdFor(file);
  const row={
    id:assetId,kind:kind??inferKind(file.type),name:String(file.name??assetId),type:String(file.type??'application/octet-stream'),
    size:Number(file.size??0),lastModified:Number(file.lastModified??0),blob:file,meta:{...meta},createdAt:new Date().toISOString()
  };
  this.memory.set(assetId,row);
  const db=await this.#db().catch(()=>null);
  if(db)await txPut(db,this.storeName,row).catch(()=>{});
  return {assetRef:`vault:${assetId}`,id:assetId,name:row.name,type:row.type,size:row.size,kind:row.kind};
 }
 async get(assetRef){
  const id=parseRef(assetRef);if(!id)return null;
  if(this.memory.has(id))return this.memory.get(id);
  const db=await this.#db().catch(()=>null);if(!db)return null;
  const row=await txGet(db,this.storeName,id).catch(()=>null);
  if(row)this.memory.set(id,row);
  return row;
 }
 async resolve(assetRef){
  const row=await this.get(assetRef);
  if(!row?.blob)throw codeError('BENCHMARK_ASSET_NOT_FOUND');
  return row.blob;
 }
 async remove(assetRef){
  const id=parseRef(assetRef);if(!id)return false;this.memory.delete(id);
  const db=await this.#db().catch(()=>null);if(db)await txDelete(db,this.storeName,id).catch(()=>{});
  return true;
 }
 async stats(){
  const db=await this.#db().catch(()=>null);let rows=[];
  if(db)rows=await txAll(db,this.storeName).catch(()=>[]);
  else rows=[...this.memory.values()];
  return {count:rows.length,bytes:rows.reduce((n,x)=>n+Number(x.size??0),0)};
 }
 async #db(){
  if(typeof indexedDB==='undefined')throw codeError('INDEXEDDB_UNAVAILABLE');
  if(this.dbPromise)return this.dbPromise;
  this.dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(this.dbName,this.version);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(this.storeName))db.createObjectStore(this.storeName,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error??codeError('INDEXEDDB_OPEN_FAILED'));
  });
  return this.dbPromise;
 }
}
export function isVaultRef(ref){return /^vault:/.test(String(ref??''))}
function parseRef(ref){const m=/^vault:(.+)$/.exec(String(ref??''));return m?.[1]??null}
async function assetIdFor(file){
 const buf=await file.arrayBuffer();
 if(globalThis.crypto?.subtle){
  const digest=await crypto.subtle.digest('SHA-256',buf);
  return [...new Uint8Array(digest)].slice(0,16).map(x=>x.toString(16).padStart(2,'0')).join('');
 }
 let h=2166136261;for(const b of new Uint8Array(buf)){h^=b;h=Math.imul(h,16777619)}
 return `${(h>>>0).toString(16)}-${file.size??0}`;
}
function inferKind(type=''){return type.startsWith('image/')?'image':type.startsWith('audio/')?'audio':'file'}
function txPut(db,store,row){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(row);tx.oncomplete=()=>resolve(row);tx.onerror=()=>reject(tx.error)})}
function txGet(db,store,id){return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(id);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error)})}
function txDelete(db,store,id){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error)})}
function txAll(db,store){return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result??[]);req.onerror=()=>reject(req.error)})}
function codeError(code){return Object.assign(new Error(code),{code})}

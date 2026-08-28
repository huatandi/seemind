import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryModelStore} from '../core/models/model-store.js';
import {ModelDeliveryManager} from '../core/models/model-delivery-manager.js';
import {createModelManifest,modelCacheKey} from '../core/models/model-manifest.js';
import {sha256Integrity} from '../core/models/model-integrity.js';
import {buildOfflineCapabilityState} from '../core/models/offline-capability-state.js';

const response=bytes=>({ok:true,status:200,headers:{get:()=>String(bytes.length)},body:null,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});

test('offline state keeps local abilities but explicitly disables fresh search and Teacher',()=>{
 const x=buildOfflineCapabilityState({online:false,models:[{id:'vision',offlineReady:true,capabilities:['object_identity']}],localCapabilities:['ocr','barcode'],cachedKnowledge:true});
 assert.deepEqual(x.localCapabilities.sort(),['barcode','object_identity','ocr']);
 assert.equal(x.searchAvailable,false);assert.equal(x.teacherAvailable,false);assert.equal(x.policy,'LOCAL_ONLY_STATE_LIMITATIONS_EXPLICITLY');
});

test('deep audit detects bytes corrupted after metadata said verified and repair removes them',async()=>{
 const good=new TextEncoder().encode('good-model'),bad=new TextEncoder().encode('evil-model');
 const integrity=await sha256Integrity(good),store=new MemoryModelStore();
 const m=createModelManifest({id:'v',version:'1',files:[{path:'m',url:'https://x/m',integrity,bytes:good.length}]});
 const key=modelCacheKey(m,m.files[0]);await store.put(key,bad,{verified:true,integrity,bytes:bad.length});
 const dm=new ModelDeliveryManager({store,online:()=>false});
 assert.equal((await dm.status(m)).ready,true); // metadata-only fast path
 const audit=await dm.audit(m,{repair:true});
 assert.equal(audit.healthy,false);assert.equal(await store.has(key),false);
});

test('storage preflight accounts for cached files and preserves reserve headroom',async()=>{
 const store=new MemoryModelStore();store.estimate=async()=>({usage:80,quota:200});
 const m=createModelManifest({id:'v',version:'1',files:[{path:'a',url:'https://x/a',bytes:90}]});
 const dm=new ModelDeliveryManager({store,online:()=>true});
 const x=await dm.storagePreflight(m,{reserveBytes:40});
 assert.equal(x.neededBytes,90);assert.equal(x.availableBytes,120);assert.equal(x.canFit,false);
});

test('verified cache survives offline and avoids fetch after install',async()=>{
 const bytes=new TextEncoder().encode('model'),integrity=await sha256Integrity(bytes),store=new MemoryModelStore();let calls=0;
 const m=createModelManifest({id:'v',version:'1',files:[{path:'m',url:'https://x/m',integrity,bytes:bytes.length}]});
 const dm=new ModelDeliveryManager({store,online:()=>true,fetchImpl:async()=>{calls++;return response(bytes)}});
 await dm.ensure(m);dm.online=()=>false;const r=await dm.ensure(m,{offlineOnly:true});
 assert.equal(r.ready,true);assert.equal(r.reused,true);assert.equal(calls,1);
});

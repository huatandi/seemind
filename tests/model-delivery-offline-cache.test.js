import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelManifest,modelCacheKey} from '../core/models/model-manifest.js';
import {MemoryModelStore} from '../core/models/model-store.js';
import {ModelAssetStore} from '../core/models/model-asset-store.js';
import {ModelDeliveryManager} from '../core/models/model-delivery-manager.js';
import {sha256Integrity} from '../core/models/model-integrity.js';
import {TransformersDetrProvider} from '../providers/local/vision/transformers-detr-provider.js';

function response(bytes,{status=200}={}){
 return {
  ok:status>=200&&status<300,status,
  headers:{get:()=>String(bytes.byteLength)},
  body:null,
  arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),
 };
}

test('manifest locks model id/version and file metadata',()=>{
 const m=createModelManifest({id:'demo',version:'1.2.3',files:[{path:'model.onnx',url:'https://x/model.onnx',bytes:10}]});
 assert.equal(m.id,'demo');assert.equal(m.version,'1.2.3');assert.equal(m.totalBytes,10);
 assert.equal(modelCacheKey(m,m.files[0]),'demo@1.2.3/model.onnx');
});

test('delivery downloads verifies and reuses cached model without refetch',async()=>{
 const bytes=new TextEncoder().encode('model-bytes'),integrity=await sha256Integrity(bytes);
 const store=new MemoryModelStore();let calls=0;
 const m=createModelManifest({id:'demo',version:'1',files:[{path:'model.onnx',url:'https://x/model.onnx',bytes:bytes.byteLength,integrity}]});
 const dm=new ModelDeliveryManager({store,fetchImpl:async()=>{calls++;return response(bytes)},online:()=>true});
 const a=await dm.ensure(m);const b=await dm.ensure(m);
 assert.equal(a.ready,true);assert.equal(b.reused,true);assert.equal(calls,1);
});

test('integrity mismatch deletes bad cache and fails instead of running corrupt model',async()=>{
 const good=new TextEncoder().encode('good'),bad=new TextEncoder().encode('bad'),integrity=await sha256Integrity(good);
 const store=new MemoryModelStore();
 const m=createModelManifest({id:'demo',version:'1',files:[{path:'model.onnx',url:'https://x/model.onnx',integrity}]});
 const dm=new ModelDeliveryManager({store,fetchImpl:async()=>response(bad),online:()=>true});
 await assert.rejects(()=>dm.ensure(m,{retries:0}),/MODEL_INTEGRITY_MISMATCH/);
 assert.equal(await store.has(modelCacheKey(m,m.files[0])),false);
});

test('offline-only mode refuses uncached model but accepts verified cached model',async()=>{
 const bytes=new TextEncoder().encode('offline'),integrity=await sha256Integrity(bytes),store=new MemoryModelStore();
 const m=createModelManifest({id:'demo',version:'1',files:[{path:'model.onnx',url:'https://x/model.onnx',integrity}]});
 const dm=new ModelDeliveryManager({store,fetchImpl:async()=>response(bytes),online:()=>false});
 await assert.rejects(()=>dm.ensure(m,{offlineOnly:true}),/MODEL_NOT_AVAILABLE_OFFLINE/);
 await store.put(modelCacheKey(m,m.files[0]),bytes,{verified:true,bytes:bytes.byteLength});
 const r=await dm.ensure(m,{offlineOnly:true});assert.equal(r.ready,true);assert.equal(r.reused,true);
});

test('storage budget blocks a model before download starts',async()=>{
 const store=new MemoryModelStore();let calls=0;
 const m=createModelManifest({id:'big',version:'1',files:[{path:'m',url:'https://x/m',bytes:1000}]});
 const dm=new ModelDeliveryManager({store,fetchImpl:async()=>{calls++;return response(new Uint8Array(1000))},online:()=>true});
 await assert.rejects(()=>dm.ensure(m,{maxBytes:100}),/MODEL_STORAGE_BUDGET_EXCEEDED/);
 assert.equal(calls,0);
});

test('failed file download retries and can recover',async()=>{
 const bytes=new TextEncoder().encode('retry'),store=new MemoryModelStore();let calls=0;
 const m=createModelManifest({id:'demo',version:'1',files:[{path:'m',url:'https://x/m'}]});
 const dm=new ModelDeliveryManager({store,fetchImpl:async()=>{calls++;return calls===1?response(bytes,{status:503}):response(bytes)},online:()=>true});
 const r=await dm.ensure(m,{retries:1});assert.equal(r.ready,true);assert.equal(calls,2);
});

test('removeOtherVersions keeps only current model version',async()=>{
 const store=new MemoryModelStore(),dm=new ModelDeliveryManager({store,online:()=>false});
 const old=createModelManifest({id:'demo',version:'1',files:[{path:'m',url:'https://x/v1/m'}]});
 const cur=createModelManifest({id:'demo',version:'2',files:[{path:'m',url:'https://x/v2/m'}]});
 await store.put(modelCacheKey(old,old.files[0]),new Uint8Array([1]),{verified:true});
 await store.put(modelCacheKey(cur,cur.files[0]),new Uint8Array([2]),{verified:true});
 const r=await dm.removeOtherVersions(cur);
 assert.equal(r.removed,1);assert.equal(await store.has(modelCacheKey(cur,cur.files[0])),true);
});

test('asset store caches bytes under the actual model URL for service-worker fetch interception',async()=>{
 const store=new ModelAssetStore();
 const url='https://models.example/model.onnx',bytes=new Uint8Array([1,2,3]);
 await store.putByUrl(url,bytes);
 assert.equal(await store.hasByUrl(url),true);
 assert.deepEqual([...(await store.getByUrl(url))],[1,2,3]);
});

test('DETR provider can require delivery manager before runtime load',async()=>{
 const events=[];let pipelineLoads=0;
 const manifest=createModelManifest({id:'demo',version:'1',files:[{path:'m',url:'https://x/m'}]});
 const dm={ensure:async(m,opts)=>{events.push({m,opts});return {ready:true}}};
 const p=new TransformersDetrProvider({
   modelDeliveryManager:dm,modelManifest:manifest,offlineOnly:true,
   pipelineLoader:async()=>({env:{useBrowserCache:false},pipeline:async()=>{pipelineLoads++;return async()=>[]}}),
 });
 await p.load();
 assert.equal(events.length,1);assert.equal(events[0].opts.offlineOnly,true);assert.equal(pipelineLoads,1);
});

test('progress events expose file start/progress/complete for UI',async()=>{
 const bytes=new Uint8Array([1,2,3,4]),store=new MemoryModelStore(),events=[];
 const m=createModelManifest({id:'demo',version:'1',files:[{path:'m',url:'https://x/m',bytes:4}]});
 const dm=new ModelDeliveryManager({store,fetchImpl:async()=>response(bytes),online:()=>true});
 await dm.ensure(m,{onProgress:e=>events.push(e)});
 assert.ok(events.some(x=>x.type==='model_file_start'));
 assert.ok(events.some(x=>x.type==='model_file_progress'));
 assert.ok(events.some(x=>x.type==='model_file_complete'));
});

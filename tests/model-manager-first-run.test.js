import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelManager} from '../core/models/model-manager.js';
import {MemoryModelStore} from '../core/models/model-store.js';
import {ModelDeliveryManager} from '../core/models/model-delivery-manager.js';
import {createModelManifest} from '../core/models/model-manifest.js';
import {createDefaultVisualProviders} from '../providers/local/vision/default-visual-providers.js';

function item(){
  const bytes=new Uint8Array([1,2,3,4]);
  return {
    id:'vision',name:'Vision',description:'test',estimatedDownloadBytes:4,providerId:'x',
    manifest:createModelManifest({id:'m',version:'1',files:[{path:'m',url:'https://x/m',bytes:4}]})
  };
}

test('large general vision provider is opt-in by default',()=>{
  const providers=createDefaultVisualProviders();
  assert.equal(providers.some(x=>x.id==='transformers-detr'),false);
  assert.ok(providers.some(x=>x.id==='pixel-color-state'));
});

test('general vision provider appears only when explicitly enabled',()=>{
  const providers=createDefaultVisualProviders({enableGeneralVision:true,detrOptions:{pipelineLoader:async()=>({pipeline:async()=>async()=>[]})}});
  assert.equal(providers.some(x=>x.id==='transformers-detr'),true);
});

test('model manager reports not-installed before user action',async()=>{
  const manager=new ModelManager({catalog:[item()],deliveryManager:new ModelDeliveryManager({store:new MemoryModelStore(),online:()=>true,fetchImpl:async()=>{throw new Error('should-not-fetch')}})});
  const s=await manager.status('vision');
  assert.equal(s.state,'not_installed');
  assert.equal(s.offlineReady,false);
});

test('status check never downloads model',async()=>{
  let calls=0;
  const manager=new ModelManager({catalog:[item()],deliveryManager:new ModelDeliveryManager({store:new MemoryModelStore(),online:()=>true,fetchImpl:async()=>{calls++;throw new Error('unexpected')}})});
  await manager.status('vision');
  assert.equal(calls,0);
});

test('explicit install transitions model to offline-ready',async()=>{
  const bytes=new Uint8Array([1,2,3,4]);
  const manager=new ModelManager({catalog:[item()],deliveryManager:new ModelDeliveryManager({
    store:new MemoryModelStore(),online:()=>true,
    fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>String(bytes.length)},body:null,arrayBuffer:async()=>bytes.buffer})
  })});
  await manager.install('vision',{maxBytes:8});
  const s=await manager.status('vision');
  assert.equal(s.offlineReady,true);
  assert.equal(s.state,'ready');
});

test('canceling/never invoking install leaves OCR/lightweight provider path untouched',()=>{
  const providers=createDefaultVisualProviders({enableGeneralVision:false});
  assert.deepEqual(providers.map(x=>x.id).sort(),['browser-barcode','pixel-color-state']);
});

test('model removal returns state to not-installed',async()=>{
  const bytes=new Uint8Array([1,2,3,4]);
  const manager=new ModelManager({catalog:[item()],deliveryManager:new ModelDeliveryManager({
    store:new MemoryModelStore(),online:()=>true,
    fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>String(bytes.length)},body:null,arrayBuffer:async()=>bytes.buffer})
  })});
  await manager.install('vision',{maxBytes:8});
  await manager.remove('vision');
  assert.equal((await manager.status('vision')).state,'not_installed');
});

test('failed install is isolated as failed state',async()=>{
  const manager=new ModelManager({catalog:[item()],deliveryManager:new ModelDeliveryManager({
    store:new MemoryModelStore(),online:()=>true,
    fetchImpl:async()=>({ok:false,status:503,headers:{get:()=>null}})
  })});
  await assert.rejects(()=>manager.install('vision',{maxBytes:8}));
  const s=await manager.status('vision');
  assert.equal(s.state,'failed');
});

test('manager emits progress/state events for UI',async()=>{
  const bytes=new Uint8Array([1,2,3,4]),events=[];
  const manager=new ModelManager({catalog:[item()],deliveryManager:new ModelDeliveryManager({
    store:new MemoryModelStore(),online:()=>true,
    fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>String(bytes.length)},body:null,arrayBuffer:async()=>bytes.buffer})
  })});
  manager.subscribe(e=>events.push(e.type));
  await manager.install('vision',{maxBytes:8});
  assert.ok(events.includes('model_progress'));
  assert.ok(events.includes('model_state'));
});

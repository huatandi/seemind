import {createModelManifest} from '../core/models/model-manifest.js';
import {MemoryModelStore} from '../core/models/model-store.js';
import {ModelDeliveryManager} from '../core/models/model-delivery-manager.js';
import {sha256Integrity} from '../core/models/model-integrity.js';

const bytes=new TextEncoder().encode('seemind-model');
const integrity=await sha256Integrity(bytes);
const manifest=createModelManifest({
  id:'demo-vision',version:'1.0.0',
  files:[{path:'model.onnx',url:'https://models.example/model.onnx',bytes:bytes.byteLength,integrity}]
});
let calls=0;const events=[];
const dm=new ModelDeliveryManager({
  store:new MemoryModelStore(),
  online:()=>true,
  fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>String(bytes.byteLength)},body:null,arrayBuffer:async()=>bytes.buffer}),
});
const first=await dm.ensure(manifest,{onProgress:e=>events.push(e)});
const second=await dm.ensure(manifest);
const checks=[
  first.ready===true,
  first.downloadedBytes===bytes.byteLength,
  second.reused===true,
  events.some(x=>x.type==='model_file_start'),
  events.some(x=>x.type==='model_file_complete'),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Model Delivery & Offline Cache Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),first,second,eventTypes:[...new Set(events.map(x=>x.type))]},null,2));
if(passed!==checks.length)process.exitCode=1;

import {ModelManager} from '../core/models/model-manager.js';
import {MemoryModelStore} from '../core/models/model-store.js';
import {ModelDeliveryManager} from '../core/models/model-delivery-manager.js';
import {createModelManifest} from '../core/models/model-manifest.js';
import {createDefaultVisualProviders} from '../providers/local/vision/default-visual-providers.js';

const bytes=new Uint8Array([1,2,3,4,5]),store=new MemoryModelStore();let fetches=0;
const manifest=createModelManifest({id:'lab-model',version:'1',files:[{path:'model.onnx',url:'https://x/model.onnx',bytes:bytes.length}]});
const manager=new ModelManager({
  catalog:[{id:'vision',name:'Vision Student',description:'lab',estimatedDownloadBytes:bytes.length,manifest}],
  deliveryManager:new ModelDeliveryManager({store,online:()=>true,fetchImpl:async()=>{fetches++;return{ok:true,status:200,headers:{get:()=>String(bytes.length)},body:null,arrayBuffer:async()=>bytes.buffer}}}),
});
const before=await manager.status('vision');
const lightweight=createDefaultVisualProviders();
const afterStatusFetches=fetches;
await manager.install('vision',{maxBytes:10});
const ready=await manager.status('vision');
await manager.remove('vision');
const removed=await manager.status('vision');
const checks=[
 before.state==='not_installed'&&afterStatusFetches===0,
 lightweight.every(x=>x.id!=='transformers-detr'),
 ready.offlineReady===true&&fetches===1,
 removed.state==='not_installed',
 createDefaultVisualProviders({enableGeneralVision:true}).some(x=>x.id==='transformers-detr'),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Model Manager UI & First-Run Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),states:{before:before.state,ready:ready.state,removed:removed.state},fetches},null,2));
if(passed!==checks.length)process.exitCode=1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelColorStateProvider,analyzePixels} from '../providers/local/vision/pixel-color-state-provider.js';
import {BrowserBarcodeProvider} from '../providers/local/vision/browser-barcode-provider.js';
import {LocalModelRuntimeProvider} from '../providers/local/vision/local-model-runtime-provider.js';
import {createDefaultVisualProviders} from '../providers/local/vision/default-visual-providers.js';
import {VisualRuntimeManager} from '../core/vision/runtime/visual-runtime-manager.js';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';

function pixels(w,h,paint){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [r,g,b,a=255]=paint(x,y);const i=(y*w+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=a}
 return {width:w,height:h,data};
}

test('pixel provider performs real local red-state analysis on pixel bytes',async()=>{
 const image=pixels(100,100,(x,y)=>x>65&&y<35?[240,20,20,255]:[80,80,80,255]);
 const p=new PixelColorStateProvider();
 const out=await p.analyze(image,{capabilities:['color_state']});
 assert.equal(out.kind,'general_vision');
 assert.ok(out.states.some(x=>x.label==='red_visual_presence'));
 assert.ok(out.regions.some(x=>x.tags.includes('color:red')));
});

test('pixel color analysis does not call color presence a diagnosis',()=>{
 const image=pixels(30,30,()=>[230,10,10,255]);
 const x=analyzePixels(image);
 assert.ok(x.limitations.some(s=>/does not.*diagnose/i.test(s)));
});

test('pixel provider recognizes green visual presence separately',async()=>{
 const image=pixels(80,80,(x,y)=>x<35?[15,220,30,255]:[70,70,70,255]);
 const out=await new PixelColorStateProvider().analyze(image,{capabilities:['color_state']});
 assert.ok(out.states.some(x=>x.label==='green_visual_presence'));
});

test('browser barcode provider uses injected native detector adapter locally',async()=>{
 const detector={detect:async()=>[{rawValue:'7501234567890',format:'ean_13',boundingBox:{x:1,y:2,width:30,height:8},cornerPoints:[]}]};
 const p=new BrowserBarcodeProvider({detectorFactory:async()=>detector});
 assert.equal((await p.healthCheck()).status,'ready');
 const out=await p.analyze({},{capabilities:['barcode_qr']});
 assert.equal(out.items[0].rawValue,'7501234567890');
 assert.equal(out.items[0].format,'ean_13');
});

test('barcode provider reports unavailable instead of pretending support',async()=>{
 const p=new BrowserBarcodeProvider({detectorFactory:async()=>null});
 assert.equal((await p.healthCheck()).status,'unavailable');
 await assert.rejects(()=>p.analyze({},{capabilities:['barcode_qr']}),/BARCODE_DETECTOR_UNAVAILABLE/);
});

test('runtime manager loads a model once and reuses it',async()=>{
 let loads=0;
 const provider={id:'runtime',load:async()=>{loads++},unload:async()=>{}};
 const m=new VisualRuntimeManager();
 assert.equal((await m.ensureLoaded(provider)).reused,false);
 assert.equal((await m.ensureLoaded(provider)).reused,true);
 assert.equal(loads,1);
 await m.unload(provider);
 assert.equal(m.state('runtime').status,'unloaded');
});

test('local model runtime adapter executes injected real runtime contract',async()=>{
 let released=false;
 const runtimeLoader=async()=>({createSession:async url=>({
   run:async input=>({identity:[{label:`model:${url}:${input.token}`,confidence:.91}],confidence:.91}),
   release:async()=>{released=true},
 })});
 const p=new LocalModelRuntimeProvider('local-runtime',{
   runtimeLoader,modelUrl:'/models/demo.onnx',
   inputAdapter:async()=>({token:'image'}),
   outputAdapter:async raw=>raw,
   capabilities:['object_identity'],estimatedMemoryMb:120,
 });
 await p.load();
 const out=await p.analyze({},{capabilities:['object_identity']});
 assert.equal(out.identity[0].label,'model:/models/demo.onnx:image');
 await p.unload();
 assert.equal(released,true);
});

test('local model runtime stays unavailable if no model URL exists',async()=>{
 const p=new LocalModelRuntimeProvider('missing',{runtimeLoader:async()=>({createSession:async()=>({})}),capabilities:['object_identity']});
 assert.equal((await p.healthCheck()).status,'unavailable');
 await assert.rejects(()=>p.load(),/MODEL_URL_MISSING/);
});

test('executor timeout isolates a hanging provider and falls back',async()=>{
 class Hanging extends PixelColorStateProvider{
   constructor(){super();this.id='hang';this.priority=100}
   async analyze(){return new Promise(()=>{})}
 }
 class Quick extends PixelColorStateProvider{
   constructor(){super();this.id='quick';this.priority=50}
 }
 const image=pixels(40,40,()=>[240,20,20,255]);
 const r=await executeVisualCapabilities({image,capabilities:['color_state'],providers:[new Hanging(),new Quick()],timeoutMs:20,deviceBudget:{maxMemoryMb:128}});
 assert.equal(r.failures[0].errorCode,'VISUAL_PROVIDER_TIMEOUT');
 assert.equal(r.results[0].providerId,'quick');
});

test('default visual providers are lightweight local adapters and do not include a fake general model',()=>{
 const p=createDefaultVisualProviders();
 assert.ok(p.some(x=>x.id==='pixel-color-state'));
 assert.ok(p.some(x=>x.id==='browser-barcode'));
 assert.equal(p.some(x=>x.capabilities.some(c=>c.capability==='general_vision')),false);
});

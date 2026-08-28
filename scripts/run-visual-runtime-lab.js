import {PixelColorStateProvider} from '../providers/local/vision/pixel-color-state-provider.js';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';
import {LocalModelRuntimeProvider} from '../providers/local/vision/local-model-runtime-provider.js';

function pixels(w,h){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const red=x>w*.68&&y<h*.35;data[i]=red?240:70;data[i+1]=red?20:70;data[i+2]=red?20:70;data[i+3]=255}
 return {width:w,height:h,data};
}
const image=pixels(120,100);
const color=new PixelColorStateProvider();
const local=await executeVisualCapabilities({image,capabilities:['color_state'],providers:[color],deviceBudget:{maxMemoryMb:128}});
const runtime=new LocalModelRuntimeProvider('adapter-demo',{
 runtimeLoader:async()=>({createSession:async()=>({run:async()=>({identity:[{label:'synthetic-object',confidence:.9}],confidence:.9}),release:async()=>{}})}),
 modelUrl:'/models/synthetic.onnx',inputAdapter:async()=>({tensor:'synthetic'}),capabilities:['object_identity'],estimatedMemoryMb:64
});
const model=await executeVisualCapabilities({image,capabilities:['object_identity'],providers:[runtime],deviceBudget:{maxMemoryMb:128}});
const checks=[
 local.results[0]?.status==='ok',
 local.results[0]?.output?.states?.some(x=>x.label==='red_visual_presence'),
 local.results[0]?.output?.regions?.some(x=>x.tags?.includes('color:red')),
 model.results[0]?.status==='ok',
 model.results[0]?.output?.identity?.[0]?.label==='synthetic-object',
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Visual Provider Runtime & Local Adapters Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),localColor:local,modelAdapter:model},null,2));
if(passed!==checks.length)process.exitCode=1;

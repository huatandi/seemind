import {TransformersDetrProvider} from '../providers/local/vision/transformers-detr-provider.js';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';
import {understandProblem} from '../core/resolution/problem-understanding.js';

let calls=0;
const loader=async()=>({
  env:{},
  pipeline:async()=>async()=>{
    calls++;
    return [
      {label:'car',score:.94,box:{xmin:.12,ymin:.30,xmax:.62,ymax:.78}},
      {label:'traffic light',score:.89,box:{xmin:.72,ymin:.08,xmax:.80,ymax:.30}},
    ];
  },
});
const provider=new TransformersDetrProvider({pipelineLoader:loader});
const image={id:'synthetic-road-image'};
const out1=await provider.analyze(image,{capabilities:['object_identity']});
const out2=await provider.analyze(image,{capabilities:['scene_context']});
const observation={
  detectedType:'object',confidence:{overall:.9},limitations:[],
  observations:[out1],
};
const mm=fuseMultimodalContext({visualObservation:observation,speechText:'这是什么？'});
const problem=understandProblem(observation,{userQuestion:'这是什么？',multimodalContext:mm});
const checks=[
  calls===1,
  out1.identity.some(x=>x.label==='car'&&x.confidence>.9),
  out1.regions.some(x=>x.objectType==='car'&&x.bbox),
  out2.scene.some(x=>x.label==='road_or_street'),
  problem.knownFacts.some(x=>x.value==='car'),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({
  suite:'First Real General-Vision Student Lab',
  modelContract:'Xenova/detr-resnet-50 via Transformers.js object-detection pipeline',
  checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),
  identity:out1.identity,scene:out2.scene,regions:out1.regions,calls,
},null,2));
if(passed!==checks.length)process.exitCode=1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {TransformersDetrProvider,normalizeDetections,inferSceneCandidates} from '../providers/local/vision/transformers-detr-provider.js';
import {routeVisualCapabilities} from '../core/vision/visual-capability-router.js';
import {buildVisualRegionEvidence} from '../core/grounding/region-evidence.js';

function mockLoader(outputs){
  return async()=>({
    env:{allowRemoteModels:true,localModelPath:'/models/'},
    pipeline:async(task,model)=>{
      assert.equal(task,'object-detection');
      assert.equal(model,'Xenova/detr-resnet-50');
      const fn=async()=>outputs;
      fn.dispose=async()=>{};
      return fn;
    },
  });
}

test('DETR provider converts real detector-style labels and boxes into general vision evidence',async()=>{
  const p=new TransformersDetrProvider({pipelineLoader:mockLoader([
    {label:'car',score:.94,box:{xmin:.10,ymin:.20,xmax:.55,ymax:.72}},
    {label:'traffic light',score:.88,box:{xmin:.70,ymin:.10,xmax:.78,ymax:.32}},
  ])});
  await p.load();
  const out=await p.analyze({synthetic:true},{capabilities:['object_identity']});
  assert.equal(out.kind,'general_vision');
  assert.equal(out.identity[0].label,'car');
  assert.equal(out.regions[0].objectType,'car');
  assert.deepEqual(out.regions[0].bbox,{x:.1,y:.2,width:.45000000000000007,height:.52});
  assert.ok(out.scene.some(x=>x.label==='road_or_street'));
});

test('low confidence detections are discarded rather than promoted to identity',()=>{
  const x=normalizeDetections([
    {label:'cat',score:.49,box:{xmin:0,ymin:0,xmax:.5,ymax:.5}},
    {label:'dog',score:.8,box:{xmin:.5,ymin:.5,xmax:1,ymax:1}},
  ],.5);
  assert.deepEqual(x.map(y=>y.label),['dog']);
});

test('scene context requires conservative object combinations',()=>{
  assert.equal(inferSceneCandidates([{label:'sink',score:.9,bbox:{}}]).some(x=>x.label==='bathroom'),false);
  assert.ok(inferSceneCandidates([
    {label:'toilet',score:.9,bbox:{}},{label:'sink',score:.9,bbox:{}}
  ]).some(x=>x.label==='bathroom'));
});

test('DETR absence is explicitly not negative evidence',async()=>{
  const p=new TransformersDetrProvider({pipelineLoader:mockLoader([])});
  const out=await p.analyze({synthetic:true},{capabilities:['object_identity']});
  assert.equal(out.identity.length,0);
  assert.ok(out.limitations.some(x=>/not evidence.*absent/i.test(x)));
});

test('general vision identity and scene satisfy visual capability router',()=>{
  const observation={detectedType:'unknown',observations:[{
    kind:'general_vision',providerId:'transformers-detr',
    identity:[{label:'car',confidence:.9}],
    scene:[{label:'road_or_street',confidence:.72}],
    regions:[{id:'r1',regionType:'object',objectType:'car',confidence:.9,bbox:{x:.1,y:.1,width:.3,height:.3},tags:['detected-object']}],
  }]};
  const route=routeVisualCapabilities({observation,userQuestion:'这是什么？'});
  assert.ok(route.localCapabilities.includes('object_identity'));
  assert.ok(route.localCapabilities.includes('scene_context'));
  assert.equal(route.missingCapabilities.includes('object_identity'),false);
});

test('general vision regions feed the existing grounding region contract',()=>{
  const observation={detectedType:'object',observations:[
    {kind:'image_preprocessing',width:1000,height:800},
    {kind:'general_vision',providerId:'transformers-detr',regions:[
      {id:'detr-1',regionType:'object',objectType:'car',confidence:.91,bbox:{x:.65,y:.2,width:.25,height:.4},tags:['detected-object','label:car']}
    ]}
  ]};
  const regions=buildVisualRegionEvidence(observation).regions;
  assert.ok(regions.some(x=>x.id==='detr-1'&&x.objectType==='car'));
});

test('provider supports local-model-only configuration without changing Core contract',async()=>{
  const p=new TransformersDetrProvider({
    pipelineLoader:mockLoader([{label:'dog',score:.9,box:{xmin:.1,ymin:.1,xmax:.4,ymax:.5}}]),
    allowRemoteModels:false,localModelPath:'/models/',
  });
  await p.load();
  const out=await p.analyze({synthetic:true},{capabilities:['object_identity']});
  assert.equal(out.identity[0].label,'dog');
});

test('provider caches one detection result across identity and scene requests for same image',async()=>{
  let calls=0;
  const loader=async()=>({env:{},pipeline:async()=>async()=>{calls++;return[
    {label:'car',score:.9,box:{xmin:.1,ymin:.1,xmax:.5,ymax:.5}},
    {label:'traffic light',score:.9,box:{xmin:.6,ymin:.1,xmax:.7,ymax:.3}},
  ]}});
  const p=new TransformersDetrProvider({pipelineLoader:loader});
  const image={id:'same-image'};
  await p.analyze(image,{capabilities:['object_identity']});
  await p.analyze(image,{capabilities:['scene_context']});
  assert.equal(calls,1);
});


test('candidate visual identity remains inference and not observed fact in explanation',async()=>{
  const {fuseMultimodalContext}=await import('../core/multimodal/multimodal-fusion.js');
  const {understandProblem}=await import('../core/resolution/problem-understanding.js');
  const {buildExplanationActionContract}=await import('../core/explanation/explanation-action-contract.js');
  const observation={detectedType:'object',confidence:{overall:.72},limitations:[],observations:[{
    kind:'general_vision',providerId:'transformers-detr',
    identity:[{label:'dog',confidence:.72,status:'candidate'}],scene:[],states:[],regions:[]
  }]};
  const mm=fuseMultimodalContext({visualObservation:observation,speechText:'这是什么？'});
  const problem=understandProblem(observation,{userQuestion:'这是什么？',multimodalContext:mm});
  const contract=buildExplanationActionContract({observation,problem,resolution:{decision:'local_explain',canOfferSolutionNow:true,nextEvidence:[],escalation:{needed:false}},multimodal:mm});
  assert.equal(contract.observed.items.some(x=>x.value==='dog'),false);
  assert.ok(contract.assessment.items.some(x=>x.kind==='visual_candidate'&&/dog/.test(x.text)));
});

test('high-confidence DETR identity can be treated as observed visual fact',async()=>{
  const {fuseMultimodalContext}=await import('../core/multimodal/multimodal-fusion.js');
  const {understandProblem}=await import('../core/resolution/problem-understanding.js');
  const observation={detectedType:'object',confidence:{overall:.9},limitations:[],observations:[{
    kind:'general_vision',providerId:'transformers-detr',
    identity:[{label:'car',confidence:.91,status:'observed'}],scene:[],states:[],regions:[]
  }]};
  const mm=fuseMultimodalContext({visualObservation:observation,textInput:'这是什么？'});
  const problem=understandProblem(observation,{userQuestion:'这是什么？',multimodalContext:mm});
  assert.ok(problem.knownFacts.some(x=>x.value==='car'));
});

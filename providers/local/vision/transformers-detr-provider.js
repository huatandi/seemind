import {VisualProvider} from '../../../core/vision/providers/visual-provider.js';
import {createGeneralVisionObservation} from '../../../core/vision/general-vision-contract.js';

export class TransformersDetrProvider extends VisualProvider {
  constructor({
    modelId='Xenova/detr-resnet-50',
    threshold=.5,
    pipelineLoader=null,
    allowRemoteModels=true,
    localModelPath=null,
    modelDeliveryManager=null,
    modelManifest=null,
    offlineOnly=false,
    modelStorageBudgetBytes=Infinity,
    onModelProgress=null,
  }={}){
    super('transformers-detr',{
      version:'1.0.0',
      capabilities:[
        {capability:'object_identity',score:.82},
        {capability:'scene_context',score:.58},
      ],
      priority:72,
      deviceClasses:['balanced','performance'],
      estimatedMemoryMb:220,
      estimatedLatencyMs:2500,
      privacyModes:['local'],
      reliability:.86,
    });
    this.modelId=modelId;
    this.threshold=threshold;
    this.pipelineLoader=pipelineLoader??defaultPipelineLoader;
    this.allowRemoteModels=Boolean(allowRemoteModels);
    this.localModelPath=localModelPath;
    this.modelDeliveryManager=modelDeliveryManager;
    this.modelManifest=modelManifest;
    this.offlineOnly=Boolean(offlineOnly);
    this.modelStorageBudgetBytes=Number(modelStorageBudgetBytes);
    this.onModelProgress=onModelProgress;
    this.detector=null;
    this.objectCache=new WeakMap();
    this.primitiveCache=new Map();
  }

  async healthCheck(){
    if(this.detector)return {status:'ready',modelId:this.modelId};
    if(typeof this.pipelineLoader!=='function')return {status:'unavailable',reason:'PIPELINE_LOADER_MISSING'};
    return {status:'ready',modelId:this.modelId};
  }

  async load(){
    if(this.detector)return;
    if(this.modelDeliveryManager&&this.modelManifest){
      await this.modelDeliveryManager.ensure(this.modelManifest,{
        offlineOnly:this.offlineOnly,
        maxBytes:Number.isFinite(this.modelStorageBudgetBytes)?this.modelStorageBudgetBytes:Infinity,
        onProgress:this.onModelProgress,
      });
    }
    const lib=await this.pipelineLoader();
    const pipeline=lib?.pipeline??lib;
    if(typeof pipeline!=='function')throw codeError('TRANSFORMERS_PIPELINE_UNAVAILABLE');
    if(lib?.env){
      if(this.localModelPath)lib.env.localModelPath=this.localModelPath;
      lib.env.allowRemoteModels=this.allowRemoteModels;
      if('useBrowserCache' in lib.env)lib.env.useBrowserCache=true;
    }
    this.detector=await pipeline('object-detection',this.modelId);
  }

  async unload(){
    try{await this.detector?.dispose?.()}finally{
      this.detector=null;
      this.objectCache=new WeakMap();
      this.primitiveCache.clear();
    }
  }

  async analyze(image,{capabilities=[]}={}){
    if(!capabilities.some(x=>x==='object_identity'||x==='scene_context'))throw codeError('UNSUPPORTED_VISUAL_CAPABILITY');
    if(!this.detector)await this.load();
    const detections=await this.#detect(image);
    const normalized=normalizeDetections(detections,this.threshold);
    const scenes=inferSceneCandidates(normalized);
    return createGeneralVisionObservation({
      providerId:this.id,
      identity:aggregateIdentity(normalized),
      scene:scenes,
      regions:normalized.map((x,i)=>({
        id:`detr-${i+1}`,
        regionType:'object',
        objectType:x.label,
        confidence:x.score,
        bbox:x.bbox,
        tags:['detected-object',`label:${slug(x.label)}`],
      })),
      confidence:normalized.length?Math.max(...normalized.map(x=>x.score)):0,
      limitations:[
        'DETR uses a fixed object vocabulary; an unrecognized object is not evidence that the object is absent.',
        'Scene context is conservatively inferred from detected object combinations and remains a candidate, not a confirmed scene label.',
      ],
    });
  }

  async #detect(image){
    const cached=getCache(this,image);if(cached)return cached;
    const source=await toDetectorInput(image);
    try{
      const input=source?.__seemindObjectUrl?source.url:source;
      const out=await this.detector(input,{threshold:this.threshold,percentage:true});
      setCache(this,image,out);
      return out;
    }finally{
      if(source?.__seemindObjectUrl)URL.revokeObjectURL(source.url);
    }
  }
}

export function normalizeDetections(output=[],threshold=.5){
  return (Array.isArray(output)?output:[]).map(x=>({
    label:String(x.label??'unknown'),
    score:Number(x.score??0),
    bbox:normalizeBox(x.box),
  })).filter(x=>x.label!=='unknown'&&x.score>=threshold&&x.bbox);
}

export function inferSceneCandidates(detections=[]){
  const labels=new Set(detections.map(x=>x.label.toLowerCase()));
  const defs=[
    ['road_or_street',['car','truck','bus','traffic light','stop sign','motorcycle'],2],
    ['kitchen',['refrigerator','oven','microwave','sink','toaster'],2],
    ['dining_area',['dining table','fork','knife','spoon','bowl','wine glass'],2],
    ['workspace',['laptop','keyboard','mouse','monitor'],2],
    ['living_room',['couch','tv','chair'],2],
    ['bedroom',['bed'],1],
    ['bathroom',['toilet','sink'],2],
    ['outdoor_sports',['sports ball','skateboard','surfboard','tennis racket'],2],
  ];
  const out=[];
  for(const [label,need,min] of defs){
    const hits=need.filter(x=>labels.has(x));
    if(hits.length>=min){
      const conf=Math.min(.86,.52+hits.length*.1);
      out.push({label,confidence:conf,status:conf>=.85?'observed':'candidate',evidence:{detectedObjects:hits}});
    }
  }
  return out.sort((a,b)=>b.confidence-a.confidence);
}

function aggregateIdentity(d){
  const best=new Map();
  for(const x of d){
    const prev=best.get(x.label);
    if(!prev||x.score>prev.score)best.set(x.label,x);
  }
  return [...best.values()].sort((a,b)=>b.score-a.score).slice(0,12).map(x=>({
    label:x.label,confidence:x.score,status:x.score>=.85?'observed':'candidate',evidenceLevel:'category',
    evidence:{provider:'DETR',bbox:x.bbox,semanticLevel:'category'},
  }));
}
function normalizeBox(b){
  if(!b)return null;
  const xmin=Number(b.xmin),ymin=Number(b.ymin),xmax=Number(b.xmax),ymax=Number(b.ymax);
  if(![xmin,ymin,xmax,ymax].every(Number.isFinite)||xmax<=xmin||ymax<=ymin)return null;
  return {x:xmin,y:ymin,width:xmax-xmin,height:ymax-ymin};
}
async function defaultPipelineLoader(){return import('@huggingface/transformers')}
async function toDetectorInput(image){
  if(typeof image==='string')return image;
  if(image instanceof Blob){
    if(typeof URL?.createObjectURL!=='function')throw codeError('OBJECT_URL_UNAVAILABLE');
    const url=URL.createObjectURL(image);
    return {url,__seemindObjectUrl:true,toString(){return url}};
  }
  return image;
}
function getCache(self,image){
  if(image&&typeof image==='object')return self.objectCache.get(image);
  return self.primitiveCache.get(String(image));
}
function setCache(self,image,value){
  if(image&&typeof image==='object')self.objectCache.set(image,value);
  else self.primitiveCache.set(String(image),value);
}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function codeError(code){return Object.assign(new Error(code),{code})}

import {createModelManifest} from './model-manifest.js';

export function createDetrResnet50Manifest({
  version='transformersjs-v3',
  baseUrl='/models/Xenova/detr-resnet-50/',
  files=[
    {path:'config.json',bytes:null,integrity:null},
    {path:'preprocessor_config.json',bytes:null,integrity:null},
    {path:'onnx/model_quantized.onnx',bytes:null,integrity:null},
  ],
}={}){
  return createModelManifest({
    id:'Xenova/detr-resnet-50',
    version,
    providerId:'transformers-detr',
    estimatedMemoryMb:220,
    source:'self-hosted-or-transformersjs-cache',
    files:files.map(f=>({...f,url:new URL(f.path,absoluteBase(baseUrl)).toString()})),
  });
}
function absoluteBase(base){
  if(/^https?:\/\//i.test(base))return base.endsWith('/')?base:`${base}/`;
  const origin=globalThis.location?.origin??'https://seemind.local';
  return new URL(base.endsWith('/')?base:`${base}/`,origin).toString();
}


export function createRemoteDetrResnet50Manifest({
  revision='main',
  version='hf-main-quantized',
}={}){
  const base=`https://huggingface.co/Xenova/detr-resnet-50/resolve/${revision}/`;
  return createModelManifest({
    id:'Xenova/detr-resnet-50',
    version,
    providerId:'transformers-detr',
    estimatedMemoryMb:220,
    source:'huggingface',
    files:[
      {path:'config.json',url:`${base}config.json`,bytes:4810,integrity:null},
      {path:'preprocessor_config.json',url:`${base}preprocessor_config.json`,bytes:290,integrity:null},
      {path:'onnx/model_quantized.onnx',url:`${base}onnx/model_quantized.onnx`,bytes:43102531,integrity:'sha256-yuCaMH7ZJH2n4s6Lz4FSKmgX8eougrnE3eWfWWS2K08='},
    ],
  });
}

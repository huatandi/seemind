import {createRemoteDetrResnet50Manifest} from './model-catalog.js';
export function createDefaultModelCatalog(){
  const manifest=createRemoteDetrResnet50Manifest();
  return [{
    id:'general-vision-detr',
    name:'通用视觉 Student',
    description:'识别常见物体并提供位置区域；用于普通照片，不影响 OCR、语音和条码能力。',
    manifest,
    providerId:'transformers-detr',
    estimatedDownloadBytes:43107631,
    capabilities:['object_identity','scene_context'],
  }];
}

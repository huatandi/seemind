import {createExperimentalSmolVlmAdapter} from '../../../providers/experimental/vision/transformers-smolvlm-provider.js';

export const EXPERIMENTAL_ENGINE_CATALOG=Object.freeze([
 {
  id:'smolvlm-256m',
  name:'SmolVLM 256M',
  modality:'vision',
  modelId:'HuggingFaceTB/SmolVLM-256M-Instruct',
  purpose:'small_vlm_candidate',
  estimatedDownloadMb:190,
  estimatedMemoryMb:320,
  requiresExplicitConsent:true,
  defaultEnabled:false,
  tiers:['balanced','performance'],
  note:'Lab-only candidate. It is never promoted or installed merely because the adapter exists.',
 },
]);

export function getExperimentalEngineSpec(id){return EXPERIMENTAL_ENGINE_CATALOG.find(x=>x.id===id)??null}

export function createExperimentalEngine(id,{pipelineLoader=null,device='auto',dtype='q4'}={}){
 const spec=getExperimentalEngineSpec(id);
 if(!spec)throw codeError('UNKNOWN_EXPERIMENTAL_ENGINE');
 if(id==='smolvlm-256m')return createExperimentalSmolVlmAdapter({modelId:spec.modelId,pipelineLoader,device,dtype});
 throw codeError('EXPERIMENTAL_ENGINE_FACTORY_MISSING');
}

export function canOfferExperimentalEngine(spec,deviceProfile={}){
 if(!spec)return {allowed:false,reason:'UNKNOWN_ENGINE'};
 if(spec.modality!=='vision')return {allowed:false,reason:'UNSUPPORTED_MODALITY'};
 if(deviceProfile?.tier==='low_power'&&!spec.tiers.includes('low_power'))return {allowed:false,reason:'DEVICE_TIER_TOO_LOW'};
 return {allowed:true,reason:'LAB_OPT_IN_ONLY'};
}
function codeError(code){return Object.assign(new Error(code),{code})}

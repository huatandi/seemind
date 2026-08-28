import {PerceptionEngineAdapter} from '../../../core/perception/perception-engine-adapter.js';

/**
 * Experimental browser VLM adapter.
 * Default model is intentionally small and is NOT auto-registered.
 * The adapter can be instantiated by Lab code after user approval/model availability.
 */
export function createExperimentalSmolVlmAdapter({
  modelId='HuggingFaceTB/SmolVLM-256M-Instruct',
  device='auto',
  dtype='q4',
  pipelineLoader=null,
  maxNewTokens=96,
}={}){
  let pipe=null;
  const loadPipeline=pipelineLoader??defaultPipelineLoader;
  const resolveDevice=()=>device==='auto'?(hasWebGpu()?'webgpu':'wasm'):device;

  return new PerceptionEngineAdapter({
    id:`smolvlm:${modelId}`,
    profile:{
      modality:'vision',
      capabilities:['general_vision','visual_qa','object_identity','scene_context'],
      local:true,streaming:false,languages:['auto'],
      deviceTiers:['balanced','performance'],
      estimatedMemoryMb:320,
      estimatedLatencyMs:1800,
      qualityClass:'experimental',
      providerFamily:'smolvlm',
    },
    isSupported:()=>typeof Blob!=='undefined',
    load:async()=>{
      const lib=await loadPipeline();
      const pipeline=lib?.pipeline??lib;
      if(typeof pipeline!=='function')throw codeError('SMOLVLM_PIPELINE_UNAVAILABLE');
      pipe=await pipeline('image-text-to-text',modelId,{device:resolveDevice(),dtype});
    },
    infer:async(image,{prompt='Describe what is important in this image.',language='auto'}={})=>{
      if(!pipe)throw codeError('SMOLVLM_NOT_LOADED');
      const imageUrl=await toObjectUrl(image);
      try{
        const messages=[{role:'user',content:[
          {type:'image',url:imageUrl},
          {type:'text',text:promptForLanguage(prompt,language)},
        ]}];
        const out=await pipe(messages,{max_new_tokens:maxNewTokens});
        const text=extractGeneratedText(out);
        return {
          providerId:`smolvlm:${modelId}`,
          text,
          identity:text?[{label:text,confidence:.62,status:'candidate'}]:[],
          scene:[],
          confidence:{overall:text?.length?.62:0},
          limitations:['Experimental small VLM output is a candidate description until benchmarked and verified.'],
        };
      }finally{if(imageUrl?.startsWith?.('blob:'))URL.revokeObjectURL(imageUrl)}
    },
    dispose:async()=>{try{await pipe?.dispose?.()}finally{pipe=null}},
  });
}
async function defaultPipelineLoader(){return import('@huggingface/transformers')}
function hasWebGpu(){return typeof navigator!=='undefined'&&Boolean(navigator.gpu)}
async function toObjectUrl(input){
  if(typeof input==='string')return input;
  if(input instanceof Blob&&typeof URL?.createObjectURL==='function')return URL.createObjectURL(input);
  throw codeError('SMOLVLM_IMAGE_INPUT_UNSUPPORTED');
}
function promptForLanguage(prompt,language){
  if(!language||language==='auto')return prompt;
  return `${prompt}\nAnswer in language: ${language}.`;
}
function extractGeneratedText(out){
  const x=Array.isArray(out)?out[0]:out;
  const generated=x?.generated_text??x?.text??'';
  if(Array.isArray(generated))return String(generated.at(-1)?.content??generated.at(-1)?.text??'').trim();
  return String(generated).trim();
}
function codeError(code){return Object.assign(new Error(code),{code})}

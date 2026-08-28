import {decodeAudioTo16kMono} from './transformers-whisper-provider.js';

export class TransformersMoonshineProvider{
 constructor({modelId='onnx-community/moonshine-base-ONNX',pipelineLoader=null,device='auto',dtype='q8'}={}){
  this.id='moonshine-base-en';this.modelId=modelId;this.pipelineLoader=pipelineLoader;this.device=device;this.dtype=dtype;
  this.pipeline=null;this.loading=null;
  this.profile={streaming:false,local:true,fileTranscription:true,languages:['en'],experimental:true,latencyRole:'fast_english_candidate'};
 }
 isSupported(){return typeof WebAssembly!=='undefined'&&typeof AudioContext!=='undefined'}
 supportsLanguage(language='auto'){
  const base=String(language??'').toLowerCase().split(/[-_]/)[0];
  return !base||base==='auto'||base==='en';
 }
 async transcribeCase(input,{language='auto'}={}){
  if(!this.supportsLanguage(language))throw codeError('MOONSHINE_LANGUAGE_UNSUPPORTED');
  const audio=await decodeAudioTo16kMono(input);
  const pipe=await this.#ensurePipeline();
  const out=await pipe(audio,{task:'transcribe'});
  return {text:String(out?.text??'').trim(),engineId:this.id,modelId:this.modelId,language:'en'};
 }
 async #ensurePipeline(){
  if(this.pipeline)return this.pipeline;if(this.loading)return this.loading;
  this.loading=(async()=>{
   const loader=this.pipelineLoader??defaultPipelineLoader;
   const {pipeline}=await loader();
   const opts={};
   if(this.device&&this.device!=='auto')opts.device=this.device;
   if(this.dtype)opts.dtype=this.dtype;
   this.pipeline=await pipeline('automatic-speech-recognition',this.modelId,opts);
   return this.pipeline;
  })();
  try{return await this.loading}finally{this.loading=null}
 }
 async dispose(){try{await this.pipeline?.dispose?.()}catch{}this.pipeline=null}
}
async function defaultPipelineLoader(){return import('@huggingface/transformers')}
function codeError(code){return Object.assign(new Error(code),{code})}

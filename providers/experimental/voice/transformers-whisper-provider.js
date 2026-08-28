export class TransformersWhisperProvider{
 constructor({modelId='onnx-community/whisper-tiny',pipelineLoader=null,device='auto',dtype='q8'}={}){
  this.id='whisper-tiny-multilingual';this.modelId=modelId;this.pipelineLoader=pipelineLoader;this.device=device;this.dtype=dtype;
  this.pipeline=null;this.loading=null;
  this.profile={streaming:false,local:true,fileTranscription:true,languages:['multilingual'],experimental:true};
 }
 isSupported(){return typeof WebAssembly!=='undefined'&&typeof AudioContext!=='undefined'}
 async transcribeCase(input,{language='auto'}={}){
  const audio=await decodeAudioTo16kMono(input);
  const pipe=await this.#ensurePipeline();
  const options={task:'transcribe'};
  const lang=normalizeWhisperLanguage(language);if(lang)options.language=lang;
  const out=await pipe(audio,options);
  return {text:String(out?.text??'').trim(),engineId:this.id,modelId:this.modelId,language:language??'auto'};
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

export async function decodeAudioTo16kMono(input){
 if(input instanceof Float32Array)return input;
 const blob=input instanceof Blob?input:null;
 if(!blob)throw codeError('AUDIO_BLOB_REQUIRED');
 const Ctx=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!Ctx)throw codeError('WEB_AUDIO_UNAVAILABLE');
 const ctx=new Ctx();
 try{
  const decoded=await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
  const mono=mixToMono(decoded);
  if(decoded.sampleRate===16000)return mono;
  return resampleLinear(mono,decoded.sampleRate,16000);
 }finally{await ctx.close?.().catch(()=>{})}
}
function mixToMono(buffer){
 const channels=buffer.numberOfChannels,length=buffer.length,out=new Float32Array(length);
 for(let c=0;c<channels;c++){const data=buffer.getChannelData(c);for(let i=0;i<length;i++)out[i]+=data[i]/channels}
 return out;
}
function resampleLinear(input,fromRate,toRate){
 if(fromRate===toRate)return input;
 const length=Math.max(1,Math.round(input.length*toRate/fromRate)),out=new Float32Array(length),ratio=fromRate/toRate;
 for(let i=0;i<length;i++){const pos=i*ratio,a=Math.floor(pos),b=Math.min(input.length-1,a+1),t=pos-a;out[i]=(input[a]??0)*(1-t)+(input[b]??0)*t}
 return out;
}
function normalizeWhisperLanguage(language){
 const s=String(language??'').toLowerCase();if(!s||s==='auto')return null;
 const base=s.split(/[-_]/)[0];
 return ({zh:'chinese',es:'spanish',en:'english'}[base]??base);
}
async function defaultPipelineLoader(){return import('@huggingface/transformers')}
function codeError(code){return Object.assign(new Error(code),{code})}

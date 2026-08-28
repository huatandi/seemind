export class SherpaWasmProvider{
 constructor({runtimeLoader=null,modelConfig=null,id='sherpa-zh-en-wasm'}={}){
  this.id=id;this.runtimeLoader=runtimeLoader;this.modelConfig=modelConfig;
  this.runtime=null;this.recognizer=null;this.loading=null;
  this.profile={streaming:false,local:true,fileTranscription:true,languages:['zh','en'],experimental:true,runtime:'wasm',latencyRole:'zh_en_local_candidate'};
 }
 isSupported(){return typeof WebAssembly!=='undefined'}
 supportsLanguage(language='auto'){
  const base=String(language??'').toLowerCase().split(/[-_]/)[0];
  return !base||base==='auto'||base==='zh'||base==='cmn'||base==='yue'||base==='en';
 }
 async transcribeCase(input,{language='auto'}={}){
  if(!this.supportsLanguage(language))throw codeError('SHERPA_LANGUAGE_UNSUPPORTED');
  const audio=normalizeAudioInput(input);
  const recognizer=await this.#ensureRecognizer();
  const out=await runOfflineRecognizer(recognizer,audio);
  return {text:extractText(out),engineId:this.id,language};
 }
 async #ensureRecognizer(){
  if(this.recognizer)return this.recognizer;if(this.loading)return this.loading;
  this.loading=(async()=>{
   if(!this.runtimeLoader)throw codeError('SHERPA_RUNTIME_NOT_INSTALLED');
   const runtime=await this.runtimeLoader();this.runtime=runtime;
   const factory=runtime?.createOfflineRecognizer??runtime?.OfflineRecognizer?.create;
   if(typeof factory!=='function')throw codeError('SHERPA_OFFLINE_FACTORY_MISSING');
   this.recognizer=await factory(this.modelConfig??{});
   return this.recognizer;
  })();
  try{return await this.loading}finally{this.loading=null}
 }
 async dispose(){
  try{await this.recognizer?.dispose?.()}catch{}
  try{await this.recognizer?.free?.()}catch{}
  this.recognizer=null;this.runtime=null;
 }
}
async function runOfflineRecognizer(recognizer,audio){
 if(typeof recognizer.transcribe==='function')return recognizer.transcribe(audio,{sampleRate:16000});
 if(typeof recognizer.decode==='function')return recognizer.decode(audio,16000);
 if(typeof recognizer.createStream==='function'){
  const stream=recognizer.createStream();
  try{
   if(typeof stream.acceptWaveform==='function')stream.acceptWaveform(16000,audio);
   else if(typeof stream.acceptWaveformFloat32==='function')stream.acceptWaveformFloat32(audio,16000);
   else throw codeError('SHERPA_STREAM_ACCEPT_MISSING');
   await recognizer.decodeStream?.(stream);
   return recognizer.getResult?.(stream)??stream.result??{};
  }finally{try{stream.free?.()}catch{}}
 }
 throw codeError('SHERPA_OFFLINE_DECODE_MISSING');
}
function normalizeAudioInput(input){
 if(input instanceof Float32Array)return input;
 if(ArrayBuffer.isView(input))return new Float32Array(input.buffer,input.byteOffset,Math.floor(input.byteLength/4));
 throw codeError('SHERPA_EXPECTS_PCM16K_FLOAT32');
}
function extractText(out){return String(out?.text??out?.result?.text??out??'').trim()}
function codeError(code){return Object.assign(new Error(code),{code})}

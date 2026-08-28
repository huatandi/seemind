import {VisualProvider} from '../../../core/vision/providers/visual-provider.js';
import {createGeneralVisionObservation} from '../../../core/vision/general-vision-contract.js';

export class LocalModelRuntimeProvider extends VisualProvider {
  constructor(id,{runtimeLoader,modelUrl=null,inputAdapter=null,outputAdapter=null,...profile}={}){
    super(id,profile);
    this.runtimeLoader=runtimeLoader;this.modelUrl=modelUrl;this.inputAdapter=inputAdapter;this.outputAdapter=outputAdapter;
    this.runtime=null;this.session=null;
  }
  async load(){
    if(this.session)return;
    if(typeof this.runtimeLoader!=='function')throw codeError('MODEL_RUNTIME_LOADER_MISSING');
    if(!this.modelUrl)throw codeError('MODEL_URL_MISSING');
    this.runtime=await this.runtimeLoader();
    if(!this.runtime?.createSession)throw codeError('MODEL_RUNTIME_INVALID');
    this.session=await this.runtime.createSession(this.modelUrl);
  }
  async unload(){
    try{await this.session?.release?.()}finally{this.session=null;this.runtime=null}
  }
  async healthCheck(){
    if(this.session)return {status:'ready'};
    if(typeof this.runtimeLoader!=='function'||!this.modelUrl)return {status:'unavailable'};
    return {status:'ready'};
  }
  async analyze(image,request={}){
    if(!this.session)await this.load();
    const input=this.inputAdapter?await this.inputAdapter(image,request,this.runtime):image;
    const raw=await this.session.run(input);
    const parsed=this.outputAdapter?await this.outputAdapter(raw,request):raw;
    return normalizeOutput(this.id,parsed);
  }
}
function normalizeOutput(providerId,x){
  if(x?.kind==='general_vision')return x;
  return createGeneralVisionObservation({
    providerId,
    identity:x?.identity??[],scene:x?.scene??[],regions:x?.regions??[],states:x?.states??[],
    relationships:x?.relationships??[],anomalies:x?.anomalies??[],confidence:x?.confidence??0,
    limitations:x?.limitations??[],
  });
}
function codeError(code){return Object.assign(new Error(code),{code})}

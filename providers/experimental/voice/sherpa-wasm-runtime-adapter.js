/**
 * Experimental adapter around an injected sherpa-onnx WASM runtime.
 * The WASM/model assets remain external to this source tree until explicitly installed.
 */
export class SherpaWasmRuntimeAdapter{
  constructor({runtime,id='sherpa-onnx-wasm',languages=['auto']}={}){
    this.id=id;this.runtime=runtime;this.profile={streaming:true,local:true,languages,partialResults:true,alternatives:false,providerFamily:'sherpa_onnx'};
  }
  isSupported(){return Boolean(this.runtime?.start||this.runtime?.listen)}
  async listen(options={}){
    if(!this.isSupported())throw codeError('SHERPA_WASM_RUNTIME_UNAVAILABLE');
    if(this.runtime.listen)return this.runtime.listen(options);
    return this.runtime.start(options);
  }
  stop(){try{this.runtime?.stop?.()}catch{}}
}
function codeError(code){return Object.assign(new Error(code),{code})}

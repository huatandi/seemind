/**
 * Experimental adapter around an injected Moonshine runtime.
 * No Moonshine package/model is bundled by SeeMind.
 */
export class MoonshineRuntimeAdapter{
  constructor({runtime,id='moonshine-runtime',languages=['auto']}={}){
    this.id=id;this.runtime=runtime;this.profile={streaming:true,local:true,languages,partialResults:true,alternatives:false,providerFamily:'moonshine'};
  }
  isSupported(){return Boolean(this.runtime?.listen||this.runtime?.transcribeStream)}
  async listen(options={}){
    if(!this.isSupported())throw codeError('MOONSHINE_RUNTIME_UNAVAILABLE');
    if(this.runtime.listen)return this.runtime.listen(options);
    return this.runtime.transcribeStream(options);
  }
  stop(){try{this.runtime?.stop?.()}catch{}}
}
function codeError(code){return Object.assign(new Error(code),{code})}

import {buildWorldVisionBenchmarkPrompt} from './vlm-prompt-policy.js';

export function wrapExperimentalVisionEngine(adapter){
 if(!adapter?.id||typeof adapter.infer!=='function')throw codeError('INVALID_EXPERIMENTAL_ADAPTER');
 return {
  id:`experimental:${adapter.id}`,
  experimental:true,
  infer:async(blob,{case:c}={})=>{
   const out=await adapter.infer(blob,{prompt:buildWorldVisionBenchmarkPrompt(c),language:c?.language??'auto'});
   return out?.result??out;
  },
  dispose:()=>adapter.dispose?.(),
 };
}
function codeError(code){return Object.assign(new Error(code),{code})}

import {TransformersWhisperProvider} from '../../../providers/experimental/voice/transformers-whisper-provider.js';
import {TransformersMoonshineProvider} from '../../../providers/experimental/voice/transformers-moonshine-provider.js';
import {SherpaWasmProvider} from '../../../providers/experimental/voice/sherpa-wasm-provider.js';

export const EXPERIMENTAL_VOICE_ENGINE_CATALOG=Object.freeze([
 {id:'whisper-tiny-multilingual',name:'Whisper Tiny Multilingual',modality:'voice',modelId:'onnx-community/whisper-tiny',purpose:'multilingual_file_asr_candidate',estimatedDownloadMb:90,estimatedMemoryMb:260,requiresExplicitConsent:true,defaultEnabled:false,tiers:['balanced','performance'],languages:['zh','es','en','multilingual']},
 {id:'moonshine-base-en',name:'Moonshine Base (English)',modality:'voice',modelId:'onnx-community/moonshine-base-ONNX',purpose:'fast_english_file_asr_candidate',estimatedDownloadMb:200,estimatedMemoryMb:360,requiresExplicitConsent:true,defaultEnabled:false,tiers:['balanced','performance'],languages:['en']},
 {id:'sherpa-zh-en-wasm',name:'Sherpa-ONNX WASM (Chinese + English)',modality:'voice',purpose:'zh_en_wasm_candidate',estimatedDownloadMb:null,estimatedMemoryMb:null,requiresExplicitConsent:true,defaultEnabled:false,tiers:['balanced','performance'],languages:['zh','en'],requiresInstalledRuntime:true}
]);

export function getExperimentalVoiceEngineSpec(id){return EXPERIMENTAL_VOICE_ENGINE_CATALOG.find(x=>x.id===id)??null}
export function createExperimentalVoiceEngine(id,opts={}){
 const s=getExperimentalVoiceEngineSpec(id);if(!s)throw codeError('UNKNOWN_EXPERIMENTAL_VOICE_ENGINE');
 if(id==='whisper-tiny-multilingual')return new TransformersWhisperProvider({modelId:s.modelId,...opts});
 if(id==='moonshine-base-en')return new TransformersMoonshineProvider({modelId:s.modelId,...opts});
 if(id==='sherpa-zh-en-wasm')return new SherpaWasmProvider(opts);
 throw codeError('EXPERIMENTAL_VOICE_ENGINE_FACTORY_MISSING');
}
export function canOfferExperimentalVoiceEngine(spec,deviceProfile={}){
 if(!spec)return {allowed:false,reason:'UNKNOWN_ENGINE'};
 if(deviceProfile?.tier==='low_power'&&!spec.tiers.includes('low_power'))return {allowed:false,reason:'DEVICE_TIER_TOO_LOW'};
 return {allowed:true,reason:'LAB_OPT_IN_ONLY'};
}
function codeError(code){return Object.assign(new Error(code),{code})}

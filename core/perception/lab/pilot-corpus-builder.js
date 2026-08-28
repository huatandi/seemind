import {WORLD_VISION_CATEGORIES,VOICE_CATEGORIES} from './world-benchmark-blueprint.js';
import {validateCorpusManifest} from './benchmark-corpus-manifest.js';

export class PilotCorpusBuilder{
 constructor({id='seemind-pilot-v1',storage=null}={}){
  this.id=id;this.storage=storage;this.cases=[];
 }
 addVision({id,assetRef,category,expectedLabels=[],language='auto',conditions={},tags=[]}={}){
  if(!WORLD_VISION_CATEGORIES.some(x=>x.id===category))throw codeError('UNKNOWN_VISION_CATEGORY');
  return this.#add({id:id??nextId('vision',this.cases),modality:'vision',assetRef,category,language,expected:{labels:[...expectedLabels]},conditions,tags});
 }
 addVoice({id,assetRef,category='plain_intent',expectedText='',expectedIntent=null,language='auto',conditions={},tags=[]}={}){
  if(!VOICE_CATEGORIES.some(x=>x.id===category))throw codeError('UNKNOWN_VOICE_CATEGORY');
  return this.#add({id:id??nextId('voice',this.cases),modality:'voice',assetRef,category,language,expected:{text:expectedText,intent:expectedIntent},conditions,tags});
 }
 addMultimodal({id,assetRef,speechText='',textInput='',expected={},language='auto',conditions={},tags=[]}={}){
  return this.#add({id:id??nextId('multimodal',this.cases),modality:'multimodal',assetRef,category:'visual_reference',language,input:{speechText:String(speechText??''),textInput:String(textInput??'')},expected:{...expected},conditions,tags});
 }
 remove(id){const n=this.cases.length;this.cases=this.cases.filter(x=>x.id!==id);return this.cases.length<n}
 manifest(){return {schemaVersion:1,id:this.id,cases:this.cases.map(x=>structuredCloneSafe(x))}}
 status(){
  const manifest=this.manifest(),validation=validateCorpusManifest(manifest);
  const counts={vision:0,voice:0,multimodal:0};
  for(const c of this.cases)counts[c.modality]=(counts[c.modality]??0)+1;
  const targets={vision:30,voice:20,multimodal:10};
  return {validation,counts,targets,ready:Object.keys(targets).every(k=>counts[k]>=targets[k])};
 }
 save(){if(!this.storage)return false;this.storage.setItem(`seemind.corpus.${this.id}`,JSON.stringify(this.manifest()));return true}
 load(){if(!this.storage)return false;const raw=this.storage.getItem(`seemind.corpus.${this.id}`);if(!raw)return false;const m=JSON.parse(raw);this.cases=Array.isArray(m.cases)?m.cases:[];return true}
 #add(c){
  if(!c.assetRef)throw codeError('ASSET_REF_REQUIRED');
  if(this.cases.some(x=>x.id===c.id))throw codeError('DUPLICATE_CASE_ID');
  this.cases.push(c);return c;
 }
}
function nextId(prefix,cases){return `${prefix}-${String(cases.filter(x=>x.modality===prefix).length+1).padStart(3,'0')}`}
function structuredCloneSafe(x){return globalThis.structuredClone?structuredClone(x):JSON.parse(JSON.stringify(x))}
function codeError(code){return Object.assign(new Error(code),{code})}

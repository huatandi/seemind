import {PilotCorpusBuilder} from './pilot-corpus-builder.js';
import {auditGroundTruth} from './ground-truth-quality.js';
import {validateWorldBenchmarkCoverage} from './world-benchmark-blueprint.js';

export class PilotLabController{
 constructor({storage=globalThis.localStorage??null,id='seemind-pilot-v1'}={}){
  this.builder=new PilotCorpusBuilder({id,storage});this.builder.load();
 }
 addCase(input){
  const m=input.modality;
  if(m==='vision')return this.builder.addVision(input);
  if(m==='voice')return this.builder.addVoice(input);
  if(m==='multimodal')return this.builder.addMultimodal(input);
  throw codeError('UNKNOWN_MODALITY');
 }
 remove(id){const r=this.builder.remove(id);this.builder.save();return r}
 getCase(id){return this.builder.cases.find(x=>x.id===id)??null}
 save(){return this.builder.save()}
 manifest(){return this.builder.manifest()}
 dashboard(){
  const manifest=this.manifest(),status=this.builder.status(),truth=auditGroundTruth(manifest.cases);
  const vision=manifest.cases.filter(x=>x.modality==='vision');
  const world=vision.length?validateWorldBenchmarkCoverage(vision):null;
  return {status,truth,world,cases:manifest.cases};
 }
 exportJson(){return JSON.stringify(this.manifest(),null,2)}
 importJson(text){
  const parsed=JSON.parse(text);if(!Array.isArray(parsed?.cases))throw codeError('INVALID_CORPUS_JSON');
  this.builder.cases=parsed.cases;this.builder.save();return this.dashboard();
 }
}
function codeError(code){return Object.assign(new Error(code),{code})}

import {normalizeOcrResult,assertOcrResult} from './ocr-result.js';

export class OcrEngine {
  constructor(id='unknown',{
    version='unknown',
    providerType='local',
    languages=[],
    capabilities={text:true,blocks:false,bboxes:false,orientation:false},
    priority=50,
  }={}){
    this.id=String(id);
    this.version=String(version);
    this.providerType=String(providerType);
    this.languages=[...languages].map(String);
    this.capabilities={...capabilities};
    this.priority=Number(priority)||50;
  }
  async recognize(_image,_options={}){throw new Error('OcrEngine.recognize must be implemented')}
  normalize(result){return assertOcrResult(normalizeOcrResult(result,this))}
  publicProfile(){
    return {
      id:this.id,version:this.version,providerType:this.providerType,
      languages:[...this.languages],capabilities:{...this.capabilities},priority:this.priority,
    };
  }
}

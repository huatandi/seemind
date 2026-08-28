import {VisualProvider} from '../../../core/vision/providers/visual-provider.js';

export class BrowserBarcodeProvider extends VisualProvider {
  constructor({detectorFactory=null}={}){
    super('browser-barcode',{
      version:'1.0.0',capabilities:[{capability:'barcode_qr',score:.96}],
      priority:90,deviceClasses:['low_power','balanced','performance'],
      estimatedMemoryMb:4,estimatedLatencyMs:120,privacyModes:['local'],reliability:.9,
    });
    this.detectorFactory=detectorFactory??defaultFactory;
  }
  async healthCheck(){
    try{const d=await this.detectorFactory();return d?{status:'ready'}:{status:'unavailable'}}catch{return {status:'unavailable'}}
  }
  async analyze(image,{capabilities=[]}={}){
    if(!capabilities.includes('barcode_qr'))throw codeError('UNSUPPORTED_VISUAL_CAPABILITY');
    const detector=await this.detectorFactory();if(!detector)throw codeError('BARCODE_DETECTOR_UNAVAILABLE');
    const detected=await detector.detect(image);
    return {
      kind:'barcode_qr',schemaVersion:1,providerId:this.id,
      items:(detected??[]).map((x,i)=>({
        id:`barcode-${i+1}`,rawValue:String(x.rawValue??''),format:String(x.format??'unknown'),
        bbox:normalizeBox(x.boundingBox),cornerPoints:(x.cornerPoints??[]).map(p=>({x:Number(p.x),y:Number(p.y)})),
        confidence:1,
      })),
      confidence:(detected??[]).length?1:0,
      limitations:[],
    };
  }
}
async function defaultFactory(){
  if(typeof globalThis.BarcodeDetector!=='function')return null;
  const supported=await globalThis.BarcodeDetector.getSupportedFormats?.().catch?.(()=>null);
  const formats=Array.isArray(supported)&&supported.length?supported:undefined;
  return formats?new globalThis.BarcodeDetector({formats}):new globalThis.BarcodeDetector();
}
function normalizeBox(b){return b?{x:Number(b.x),y:Number(b.y),width:Number(b.width),height:Number(b.height)}:null}
function codeError(code){return Object.assign(new Error(code),{code})}

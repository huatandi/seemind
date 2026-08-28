import {OcrEngine} from '../../core/ocr/ocr-engine.js';

/**
 * PaddleOCR-ready adapter.
 * No Paddle runtime is bundled in v0.26. Inject a runner that accepts
 * (image, options) and returns provider-neutral OCR data.
 */
export class PaddleOcrEngine extends OcrEngine{
  constructor({runner=null,version='unconfigured'}={}){
    super('paddle-ocr',{
      version,providerType:'local',
      languages:['auto'],
      capabilities:{text:true,blocks:true,bboxes:true,orientation:true},
      priority:80,
    });
    this.runner=runner;
  }
  async recognize(image,{language='auto',onProgress}={}){
    if(typeof this.runner!=='function')throw new Error('PADDLE_OCR_RUNTIME_NOT_CONFIGURED');
    const started=Date.now();
    const raw=await this.runner(image,{language,onProgress});
    return this.normalize({
      engineId:this.id,engineVersion:this.version,providerType:'local',
      text:raw?.text??joinLines(raw?.lines),
      confidence:normalizeConfidence(raw?.confidence),
      blocks:(raw?.blocks??raw?.lines??[]).map(normalizePaddleBlock),
      languages:language.split('+'),
      timing:{elapsedMs:Date.now()-started},
      diagnostics:{orientation:raw?.orientation??null,mode:'paddle-adapter'},
    });
  }
}
function joinLines(lines){return Array.isArray(lines)?lines.map(x=>x?.text??'').filter(Boolean).join('\n'):''}
function normalizeConfidence(n){n=Number(n);if(!Number.isFinite(n))return 0;return n>1?Math.max(0,Math.min(1,n/100)):Math.max(0,Math.min(1,n))}
function normalizePaddleBlock(b,i){return {id:b?.id??`paddle-${i+1}`,text:b?.text??'',confidence:normalizeConfidence(b?.confidence),bbox:b?.bbox??b?.box??null,lineIndex:i}}

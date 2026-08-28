import {OcrEngine} from '../../core/ocr/ocr-engine.js';

export class HttpPaddleOcrEngine extends OcrEngine{
  constructor({gatewayUrl,fetchImpl=globalThis.fetch,timeoutMs=15000}={}){
    super('paddle-ocr',{
      version:'gateway',
      providerType:'local-service',
      languages:['auto'],
      capabilities:{text:true,blocks:true,bboxes:true,orientation:true},
      priority:85,
    });
    if(!gatewayUrl)throw new Error('PADDLE_GATEWAY_URL_REQUIRED');
    this.gatewayUrl=String(gatewayUrl).replace(/\/$/,'');
    this.fetchImpl=fetchImpl;
    this.timeoutMs=timeoutMs;
  }
  async recognize(image,{language='auto',onProgress}={}){
    if(!(image instanceof Blob))throw new TypeError('Paddle HTTP OCR expects Blob');
    onProgress?.({status:'paddle-upload',progress:.05});
    const imageBase64=await blobToBase64(image);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    let response;
    try{
      response=await this.fetchImpl(`${this.gatewayUrl}/v1/ocr/paddle`,{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({
          requestId:cryptoRandomId(),
          imageBase64,
          mimeType:image.type||'image/png',
          language,
        }),
        signal:controller.signal,
      });
    }catch(error){
      if(error?.name==='AbortError')throw coded('PADDLE_OCR_TIMEOUT');
      throw coded('PADDLE_OCR_UNAVAILABLE');
    }finally{
      clearTimeout(timer);
    }
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw coded(body?.error||'PADDLE_OCR_UNAVAILABLE');
    onProgress?.({status:'paddle-done',progress:1});
    return this.normalize(body);
  }
}
async function blobToBase64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let binary='';
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function cryptoRandomId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  return `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function coded(code){const e=new Error(code);e.code=code;return e}

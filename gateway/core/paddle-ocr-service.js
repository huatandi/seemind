export class PaddleGatewayOcrService{
  constructor({config={},fetchImpl=globalThis.fetch}={}){
    this.config=config;this.fetchImpl=fetchImpl;
    this.failures=0;this.successes=0;this.lastLatencyMs=null;this.lastErrorCode=null;
  }
  publicState(){
    return {
      enabled:Boolean(this.config.enabled),
      available:Boolean(this.config.enabled),
      endpointConfigured:Boolean(this.config.endpoint),
      successes:this.successes,
      failures:this.failures,
      lastLatencyMs:this.lastLatencyMs,
      lastErrorCode:this.lastErrorCode,
    };
  }
  async health(){
    if(!this.config.enabled)return {status:'disabled',...this.publicState()};
    const started=Date.now();
    try{
      const response=await withTimeout(this.fetchImpl(`${this.config.endpoint}/health`,{headers:{accept:'application/json'}}),Math.min(this.config.timeoutMs??12000,3000));
      if(!response.ok)throw problem('PADDLE_OCR_HEALTH_FAILED',502);
      const body=await response.json().catch(()=>({}));
      return {status:'ok',runtime:body?.runtime??'paddle-ocr',version:body?.version??null,...this.publicState(),latencyMs:Date.now()-started};
    }catch(error){
      return {status:'unavailable',...this.publicState(),latencyMs:Date.now()-started,error:error.code??'PADDLE_OCR_UNAVAILABLE'};
    }
  }
  async recognize(request={}){
    if(!this.config.enabled)throw problem('PADDLE_OCR_DISABLED',503);
    if(!request?.imageBase64)throw problem('OCR_IMAGE_REQUIRED',400);
    const started=Date.now();
    try{
      const response=await withTimeout(this.fetchImpl(`${this.config.endpoint}/v1/ocr`,{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify({
          imageBase64:request.imageBase64,
          mimeType:String(request.mimeType||'image/png'),
          language:String(request.language||'spa+eng'),
          requestId:String(request.requestId||''),
        }),
      }),this.config.timeoutMs??12000);
      if(!response.ok)throw problem(response.status===408?'PADDLE_OCR_TIMEOUT':'PADDLE_OCR_UPSTREAM_FAILED',502);
      const body=await response.json();
      validateBody(body);
      this.successes++;this.lastLatencyMs=Date.now()-started;this.lastErrorCode=null;
      return {
        engineId:'paddle-ocr',
        engineVersion:String(body.engineVersion??body.version??'unknown'),
        providerType:'local-service',
        text:String(body.text??''),
        confidence:normalizeConfidence(body.confidence),
        blocks:Array.isArray(body.blocks)?body.blocks:[],
        languages:Array.isArray(body.languages)?body.languages:String(request.language||'spa+eng').split('+'),
        capabilities:{text:true,blocks:true,bboxes:true,orientation:true},
        timing:{elapsedMs:this.lastLatencyMs},
        diagnostics:{orientation:body.orientation??null,mode:'paddle-local-service'},
      };
    }catch(error){
      this.failures++;this.lastLatencyMs=Date.now()-started;this.lastErrorCode=classify(error);
      if(error?.name==='AbortError')throw problem('PADDLE_OCR_TIMEOUT',504);
      if(error?.code)throw error;
      throw problem('PADDLE_OCR_UNAVAILABLE',503);
    }
  }
}
function validateBody(body){
  if(!body||typeof body!=='object'||typeof body.text!=='string')throw problem('PADDLE_OCR_INVALID_RESPONSE',502);
}
function normalizeConfidence(n){n=Number(n);if(!Number.isFinite(n))return 0;return n>1?Math.max(0,Math.min(1,n/100)):Math.max(0,Math.min(1,n))}
function classify(e){return e?.code??(e?.name==='AbortError'?'PADDLE_OCR_TIMEOUT':'PADDLE_OCR_UNAVAILABLE')}
function problem(code,status){const e=new Error(code);e.code=code;e.status=status;return e}
async function withTimeout(promise,ms){
  const controller=new AbortController(); // only used as timeout marker for Promise.race
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error('timeout');e.name='AbortError';reject(e)},ms)});
  try{return await Promise.race([promise,timeout])}finally{clearTimeout(timer);controller.abort()}
}

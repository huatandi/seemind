import {analyzeImageQuality,candidateEnhancementPlans,chooseEnhancementPlan} from './image-quality.js';

/**
 * OCR preprocessing with shared-source support.
 * Decode once, sample pixels once, derive multiple conservative candidates.
 * The original Blob and shared drawable are never mutated.
 */
export async function preprocessImage(file, options = {}) {
  const {maxDimension=2200,plan=null,preparedSource=null}=options;
  const batch=await preprocessImageCandidates(file,{maxDimension,maxCandidates:1,preparedSource,plans:plan?[plan]:null});
  return batch.candidates[0];
}

export async function preprocessImageCandidates(file,{maxDimension=2200,maxCandidates=3,preparedSource=null,plans=null,bitmapFactory=null,signal=null,decodeTimeoutMs=3500,totalBudgetMs=null}={}){
  throwIfAborted(signal);
  const startedAt=nowMs();
  const deadlineAt=Number.isFinite(Number(totalBudgetMs))&&Number(totalBudgetMs)>0?startedAt+Number(totalBudgetMs):null;
  if (!(file instanceof Blob)) throw new TypeError('preprocessImageCandidates expects an image Blob/File');
  const ownSource=!preparedSource;
  const decodeBudget=remainingBudget(deadlineAt);
  const source=preparedSource??await decodeSource(file,{bitmapFactory,signal,timeoutMs:decodeBudget==null?decodeTimeoutMs:Math.max(250,Math.min(decodeTimeoutMs,decodeBudget))});
  let baseCanvas=null,candidates=[],completed=false;
  throwIfAborted(signal);
  try{
    const drawable=source.drawable??source;
    const sw=Number(source.width??drawable.width??drawable.naturalWidth??0),sh=Number(source.height??drawable.height??drawable.naturalHeight??0);
    if(!sw||!sh)throw new Error('IMAGE_DIMENSIONS_UNAVAILABLE');
    const scale=Math.min(1,maxDimension/Math.max(sw,sh));
    const width=Math.max(1,Math.round(sw*scale)),height=Math.max(1,Math.round(sh*scale));

    // One resize/readback becomes the immutable pixel base for every OCR candidate.
    baseCanvas=document.createElement('canvas');baseCanvas.width=width;baseCanvas.height=height;
    const baseCtx=baseCanvas.getContext('2d',{willReadFrequently:true});
    if(!baseCtx)throw new Error('IMAGE_CANVAS_CONTEXT_UNAVAILABLE');
    baseCtx.drawImage(drawable,0,0,width,height);
    throwIfAborted(signal);throwIfBudgetExhausted(deadlineAt,'IMAGE_PREPROCESS_BUDGET_EXHAUSTED');
    const baseImage=baseCtx.getImageData(0,0,width,height);
    const quality=analyzeImageQuality(baseImage,width,height,{signal,deadlineAt});
    const selectedPlan=chooseEnhancementPlan(quality);
    const candidatePlans=(plans?.length?plans:candidateEnhancementPlans(quality)).slice(0,Math.max(1,Math.min(4,maxCandidates)));
    if(!candidatePlans.length)candidatePlans.push(selectedPlan);

    for(const candidatePlan of candidatePlans){
      throwIfAborted(signal);
      // Always allow the first candidate; later recovery variants are best-effort
      // and must not consume the recognition budget when preprocessing runs long.
      if(candidates.length&&remainingBudget(deadlineAt)!=null&&remainingBudget(deadlineAt)<=0)break;
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)throw new Error('IMAGE_CANVAS_CONTEXT_UNAVAILABLE');
      const pixels=new ImageData(new Uint8ClampedArray(baseImage.data),width,height);
      applyEnhancementToPixelsInPlace(pixels.data,candidatePlan,signal,deadlineAt);
      if((candidatePlan.sharpen??0)>0)applyLightSharpenPixelsInPlace(pixels.data,width,height,candidatePlan.sharpen,signal,deadlineAt);
      throwIfAborted(signal);
      ctx.putImageData(pixels,0,0);
      // Keep the already-rendered canvas as the local OCR input. Encoding to PNG
      // and decoding it again inside a browser OCR engine adds a full-frame
      // CPU/memory round-trip. Blob materialization remains lazy for remote
      // providers that actually require an upload payload.
      let blobPromise=null,released=false;
      const candidate={
        ocrInput:canvas,width,height,quality,selectedPlan:candidatePlan,candidatePlans,
        planId:candidatePlan.id,
        operations:{
          maxDimension,orientation:'from-image',adaptive:true,sharedDecode:Boolean(preparedSource),
          decodePolicy:'DECODE_ONCE_DERIVE_MANY',selectedPlanId:candidatePlan.id,
          grayscale:candidatePlan.grayscale,contrast:candidatePlan.contrast,brightness:candidatePlan.brightness,
          gamma:candidatePlan.gamma,sharpen:candidatePlan.sharpen,
        },
        async getBlob(){if(released)throw Object.assign(new Error('IMAGE_CANDIDATE_RELEASED'),{code:'IMAGE_CANDIDATE_RELEASED'});blobPromise??=canvasToBlob(canvas);return blobPromise},
        release(){if(released)return;released=true;canvas.width=0;canvas.height=0},
      };
      Object.defineProperty(candidate,'blob',{enumerable:true,get(){return candidate.getBlob()}});
      candidates.push(candidate);
    }
    baseCanvas.width=0;baseCanvas.height=0;baseCanvas=null;completed=true;
    return {quality,candidates,preprocessMs:roundMs(nowMs()-startedAt),budgetExhausted:remainingBudget(deadlineAt)!=null&&remainingBudget(deadlineAt)<=0,sourceReuse:{sharedDecode:Boolean(preparedSource),decodeCount:ownSource?1:0,derivedCandidates:candidates.length,policy:'DECODE_ONCE_DERIVE_MANY'}};
  }finally{
    if(baseCanvas){baseCanvas.width=0;baseCanvas.height=0}
    if(!completed)for(const candidate of candidates)candidate.release?.();
    if(ownSource)source.close?.();
  }
}

async function decodeSource(file,{bitmapFactory=null,signal=null,timeoutMs=3500}={}){
  const factory=bitmapFactory??globalThis.createImageBitmap;
  if(typeof factory!=='function')throw new Error('IMAGE_BITMAP_UNAVAILABLE');
  let bitmap;
  try{bitmap=await decodeBitmap(()=>factory(file,{imageOrientation:'from-image'}),timeoutMs,signal)}
  catch(error){if(error?.code==='IMAGE_PREPROCESS_ABORTED'||error?.code==='IMAGE_PREPROCESS_DECODE_TIMEOUT')throw error;bitmap=await decodeBitmap(()=>factory(file),timeoutMs,signal)}
  return {width:bitmap.width,height:bitmap.height,drawable:bitmap,close(){bitmap.close?.()}};
}

export function applyEnhancementToPixels(data,plan={}){
  const d=new Uint8ClampedArray(data);
  return applyEnhancementToPixelsInPlace(d,plan);
}

export function applyEnhancementToPixelsInPlace(d,plan={},signal=null,deadlineAt=null){
  const contrast=Number(plan.contrast??1),brightness=Number(plan.brightness??0),gamma=Math.max(.2,Number(plan.gamma??1)),grayscale=plan.grayscale!==false;
  // Gamma/power math is invariant for a plan. A 256-entry LUT replaces up to
  // three Math.pow calls per pixel on the OCR hot path.
  const lut=buildTransformLut(contrast,brightness,gamma);
  for(let i=0;i<d.length;i+=4){
    if((i&0x3ffff)===0){throwIfAborted(signal);throwIfBudgetExhausted(deadlineAt,'IMAGE_PREPROCESS_BUDGET_EXHAUSTED')}
    if(grayscale){const y=(77*d[i]+150*d[i+1]+29*d[i+2])>>8,v=lut[y];d[i]=d[i+1]=d[i+2]=v}
    else{d[i]=lut[d[i]];d[i+1]=lut[d[i+1]];d[i+2]=lut[d[i+2]]}
  }
  return d;
}
function buildTransformLut(contrast,brightness,gamma){const lut=new Uint8ClampedArray(256);for(let i=0;i<256;i++)lut[i]=transform(i,contrast,brightness,gamma);return lut}

export function applyLightSharpenPixelsInPlace(d,width,height,amount,signal=null,deadlineAt=null){
  const a=Math.max(0,Math.min(.35,Number(amount)||0));
  if(!a||width<3||height<3)return d;
  const stride=width*4;
  let prev=new Uint8ClampedArray(d.subarray(0,stride));
  let curr=new Uint8ClampedArray(d.subarray(stride,stride*2));
  let next=new Uint8ClampedArray(d.subarray(stride*2,stride*3));
  for(let y=1;y<height-1;y++){
    if((y&31)===0){throwIfAborted(signal);throwIfBudgetExhausted(deadlineAt,'IMAGE_PREPROCESS_BUDGET_EXHAUSTED')}
    for(let x=1;x<width-1;x++){
      const rowI=x*4,i=y*stride+rowI;
      for(let c=0;c<3;c++){
        const center=curr[rowI+c];
        const avg=(curr[rowI-4+c]+curr[rowI+4+c]+prev[rowI+c]+next[rowI+c])/4;
        d[i+c]=clamp(center+(center-avg)*a);
      }
    }
    const recycle=prev;prev=curr;curr=next;next=recycle;
    if(y+2<height)next.set(d.subarray((y+2)*stride,(y+3)*stride));
  }
  throwIfAborted(signal);
  return d;
}
function transform(v,contrast,brightness,gamma){let n=((v-128)*contrast+128+brightness)/255;n=Math.max(0,Math.min(1,n));return clamp((gamma===1?n:Math.pow(n,gamma))*255)}
function canvasToBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image preprocessing failed')),'image/png',.96))}
function clamp(v){return Math.max(0,Math.min(255,Math.round(v)))}

async function decodeBitmap(factory,timeoutMs,signal){
  throwIfAborted(signal);
  let timer,abortHandler,settled=false;
  const work=Promise.resolve().then(factory);
  work.then(bitmap=>{if(settled)bitmap?.close?.()},()=>{});
  try{return await Promise.race([work,new Promise((_,reject)=>{
    timer=setTimeout(()=>{const e=new Error('IMAGE_PREPROCESS_DECODE_TIMEOUT');e.code='IMAGE_PREPROCESS_DECODE_TIMEOUT';reject(e)},Math.max(250,Number(timeoutMs)||3500));
    if(signal){abortHandler=()=>{const e=new Error('IMAGE_PREPROCESS_ABORTED');e.code='IMAGE_PREPROCESS_ABORTED';reject(e)};if(signal.aborted)abortHandler();else signal.addEventListener?.('abort',abortHandler,{once:true})}
  })])}finally{settled=true;clearTimeout(timer);if(abortHandler)signal?.removeEventListener?.('abort',abortHandler)}
}
function throwIfAborted(signal){if(signal?.aborted){const e=new Error('IMAGE_PREPROCESS_ABORTED');e.code='IMAGE_PREPROCESS_ABORTED';throw e}}
function nowMs(){return globalThis.performance?.now?.()??Date.now()}
function roundMs(n){return Math.round(Number(n)*100)/100}
function remainingBudget(deadlineAt){return deadlineAt==null?null:Number(deadlineAt)-nowMs()}
function throwIfBudgetExhausted(deadlineAt,code){if(deadlineAt!=null&&remainingBudget(deadlineAt)<=0){const e=new Error(code);e.code=code;throw e}}

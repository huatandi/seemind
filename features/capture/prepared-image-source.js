import {withDeadline} from '../../core/performance/timeout.js';
export async function createPreparedImageSource(file,{bitmapFactory=null,timeoutMs=3500,signal=null}={}){
  if(!file)throw new Error('IMAGE_REQUIRED');
  const factory=bitmapFactory??globalThis.createImageBitmap;
  if(typeof factory==='function'){
    let bitmap;
    try{bitmap=await decodeWithDeadline(()=>factory(file,{imageOrientation:'from-image'}),timeoutMs,signal)}
    catch(error){
      if(error?.message==='IMAGE_DECODE_TIMEOUT'||error?.code==='IMAGE_DECODE_ABORTED')throw error;
      bitmap=await decodeWithDeadline(()=>factory(file),timeoutMs,signal);
    }
    return wrapDrawable(bitmap,{kind:'image_bitmap'});
  }
  if(typeof document==='undefined'||typeof Image==='undefined'||typeof URL?.createObjectURL!=='function')return null;
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(new Error('IMAGE_DECODE_FAILED'));el.src=url;
    });
    return wrapDrawable(img,{kind:'html_image',close:()=>{}});
  }finally{URL.revokeObjectURL(url)}
}

export function wrapDrawable(drawable,{kind='unknown',close=null}={}){
  const width=Number(drawable?.width??drawable?.naturalWidth??0);
  const height=Number(drawable?.height??drawable?.naturalHeight??0);
  if(!width||!height)throw new Error('IMAGE_DIMENSIONS_UNAVAILABLE');
  let closed=false;
  return {
    schemaVersion:1,kind,width,height,drawable,
    close(){if(closed)return;closed=true;try{close?.()}catch{}try{drawable?.close?.()}catch{}},
    get closed(){return closed},
  };
}

async function decodeWithDeadline(factory,timeoutMs,signal=null){
  const ms=Math.max(250,Number(timeoutMs)||3500);
  let timer,settled=false;
  const work=Promise.resolve().then(factory);
  // If a browser decode finishes after our deadline, release the late bitmap
  // rather than leaking GPU/native image memory.
  work.then(value=>{if(settled)try{value?.close?.()}catch{}},()=>{});
  try{
    return await withDeadline(work,ms,'IMAGE_DECODE_TIMEOUT',{signal,abortCode:'IMAGE_DECODE_ABORTED'});
  }finally{settled=true;clearTimeout(timer)}
}

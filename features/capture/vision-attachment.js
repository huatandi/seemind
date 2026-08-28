import {createVisionAttachment} from '../../core/vision/vision-attachment.js';

export async function prepareVisionAttachment(file,{maxDimension=1600,quality=.82,maxBytes=1_600_000,preparedSource=null,onPreparedSourceConsumed=null}={}){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('IMAGE_REQUIRED');
  const ownSource=!preparedSource;
  const source=preparedSource??await loadBitmap(file);
  const drawable=source.drawable??source._img??source;
  const sourceWidth=Number(source.width??drawable.width??drawable.naturalWidth??0),sourceHeight=Number(source.height??drawable.height??drawable.naturalHeight??0);
  const scale=Math.min(1,maxDimension/Math.max(sourceWidth,sourceHeight));
  const width=Math.max(1,Math.round(sourceWidth*scale));
  const height=Math.max(1,Math.round(sourceHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(drawable,0,0,width,height);
  if(ownSource)source.close?.();else onPreparedSourceConsumed?.();
  let q=quality, blob;
  do{blob=await canvasToBlob(canvas,'image/jpeg',q);q-=.08;}while(blob.size>maxBytes&&q>=.5);
  if(blob.size>maxBytes)throw new Error('VISION_IMAGE_TOO_LARGE');
  const dataUrl=await blobToDataUrl(blob);
  return createVisionAttachment({id:`vision-${Date.now()}`,mimeType:'image/jpeg',width,height,byteLength:blob.size,dataUrl});
}

async function loadBitmap(file){
  if(typeof createImageBitmap==='function')return createImageBitmap(file);
  const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight,close(){},_img:img});img.onerror=reject;img.src=url;});}finally{URL.revokeObjectURL(url);}
}
function canvasToBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('IMAGE_COMPRESSION_FAILED')),type,quality));}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error||new Error('IMAGE_READ_FAILED'));r.readAsDataURL(blob);});}

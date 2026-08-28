const ALLOWED_IMAGE_MIME = new Set(['image/jpeg','image/png','image/webp']);
const DEFAULT_MAX_BYTES = 1_600_000;

export function createVisionAttachment({id='vision-1',mimeType,width,height,byteLength,dataUrl,source='user_capture'}={}){
  const attachment={schemaVersion:1,id:String(id),type:'image',source,mimeType:String(mimeType||''),width:Number(width||0),height:Number(height||0),byteLength:Number(byteLength||0),dataUrl:String(dataUrl||'')};
  const checked=validateVisionAttachment(attachment);
  if(!checked.ok) throw new Error(`Invalid vision attachment: ${checked.issues.join(',')}`);
  return attachment;
}

export function validateVisionAttachment(value,{maxBytes=DEFAULT_MAX_BYTES}={}){
  const issues=[];
  if(!value||value.type!=='image')issues.push('type');
  if(!ALLOWED_IMAGE_MIME.has(value?.mimeType))issues.push('mime_type');
  if(!Number.isFinite(Number(value?.byteLength))||Number(value.byteLength)<=0||Number(value.byteLength)>maxBytes)issues.push('byte_length');
  if(!Number.isFinite(Number(value?.width))||Number(value.width)<=0)issues.push('width');
  if(!Number.isFinite(Number(value?.height))||Number(value.height)<=0)issues.push('height');
  if(!isSafeImageDataUrl(value?.dataUrl,value?.mimeType))issues.push('data_url');
  return {ok:issues.length===0,issues};
}

export function withVisionAttachments(taskPackage,attachments=[]){
  return {...taskPackage,media:attachments.map(x=>({...x}))};
}

export function stripVisionData(taskPackage){
  const clone=structuredCloneSafe(taskPackage??{});
  clone.media=(clone.media??[]).map(({dataUrl,...meta})=>meta);
  return clone;
}

export function isSafeImageDataUrl(dataUrl,mimeType){
  if(typeof dataUrl!=='string'||!dataUrl.startsWith(`data:${mimeType};base64,`))return false;
  const payload=dataUrl.slice(dataUrl.indexOf(',')+1);
  return payload.length>0 && /^[A-Za-z0-9+/=]+$/.test(payload);
}

function structuredCloneSafe(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));}

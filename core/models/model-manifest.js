export function createModelManifest({id,version,providerId=null,files=[],estimatedMemoryMb=0,license=null,source=null}={}){
  if(!id||!version)throw new Error('MODEL_MANIFEST_ID_VERSION_REQUIRED');
  const normalized=files.map((f,i)=>normalizeFile(f,i));
  const paths=new Set();
  for(const f of normalized){
    if(paths.has(f.path))throw new Error(`DUPLICATE_MODEL_FILE:${f.path}`);
    paths.add(f.path);
  }
  return {
    schemaVersion:1,
    id:String(id),
    version:String(version),
    providerId:providerId?String(providerId):null,
    files:normalized,
    totalBytes:normalized.reduce((s,x)=>s+(x.bytes??0),0),
    estimatedMemoryMb:Number(estimatedMemoryMb)||0,
    license:license??null,
    source:source??null,
  };
}
export function modelCacheKey(manifest,file){
  return `${manifest.id}@${manifest.version}/${file.path}`;
}
export function validateManifest(manifest){
  try{
    const m=createModelManifest(manifest);
    return {valid:true,manifest:m,errors:[]};
  }catch(error){return {valid:false,manifest:null,errors:[String(error?.message??error)]}}
}
function normalizeFile(f,i){
  if(!f?.path||!f?.url)throw new Error(`MODEL_FILE_PATH_URL_REQUIRED:${i}`);
  const integrity=f.integrity?String(f.integrity):null;
  if(integrity&&!/^sha256-[A-Za-z0-9+/=]+$/.test(integrity))throw new Error(`INVALID_MODEL_INTEGRITY:${f.path}`);
  return {
    path:String(f.path).replace(/^\/+/,''),
    url:String(f.url),
    bytes:Number.isFinite(Number(f.bytes))?Number(f.bytes):null,
    integrity,
    optional:Boolean(f.optional),
  };
}

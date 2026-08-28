export async function sha256Integrity(data){
  const bytes=toUint8(data);
  if(globalThis.crypto?.subtle){
    const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
    return `sha256-${toBase64(new Uint8Array(digest))}`;
  }
  try{
    const {createHash}=await import('node:crypto');
    return `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  }catch{throw Object.assign(new Error('SHA256_UNAVAILABLE'),{code:'SHA256_UNAVAILABLE'})}
}
export async function verifyIntegrity(data,expected){
  if(!expected)return {ok:true,expected:null,actual:null,skipped:true};
  const actual=await sha256Integrity(data);
  return {ok:actual===expected,expected,actual,skipped:false};
}
function toUint8(v){if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);throw new Error('INTEGRITY_BINARY_REQUIRED')}
function toBase64(bytes){
  if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
  let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);
}

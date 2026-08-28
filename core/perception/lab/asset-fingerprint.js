export async function fingerprintAsset(input){
 const bytes=await toBytes(input);
 if(globalThis.crypto?.subtle){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return `sha256:${[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
 }
 return `fnv1a:${fnv(new Uint8Array(bytes)).toString(16).padStart(8,'0')}`;
}
async function toBytes(input){
 if(input instanceof ArrayBuffer)return input;
 if(ArrayBuffer.isView(input))return input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);
 if(input?.arrayBuffer)return input.arrayBuffer();
 return new TextEncoder().encode(String(input??'')).buffer;
}
function fnv(bytes){let h=2166136261;for(const b of bytes){h^=b;h=Math.imul(h,16777619)}return h>>>0}

export function buildSourceProvenance(source={},meta={}){
 const url=String(source.url??source.link??'');
 let hostname=null;try{hostname=new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{}
 return {
   schemaVersion:1,
   sourceId:String(source.id??meta.sourceId??randomId()),
   url,
   hostname,
   title:String(source.title??'').slice(0,500),
   publisher:source.publisher?String(source.publisher).slice(0,300):null,
   sourceType:source.sourceType??meta.sourceType??null,
   publishedAt:source.publishedAt??null,
   accessedAt:source.accessedAt??meta.accessedAt??new Date().toISOString(),
   fetchedVia:meta.fetchedVia??source.fetchedVia??'search',
   queryFingerprint:meta.queryFingerprint??null,
   requestId:meta.requestId??null,
   canonicalSource:source.canonicalSource??null,
   upstreamSource:source.upstreamSource??null,
   license:normalizeLicense(source.license??meta.license??null),
   attributionRequired:source.attributionRequired!==false,
   cachePolicy:source.cachePolicy??meta.cachePolicy??'metadata_only',
 };
}

export function attachSourceProvenance(evidence={},meta={}){
 const provenance=buildSourceProvenance(evidence,meta);
 return {...evidence,provenance,accessedAt:evidence.accessedAt??provenance.accessedAt};
}

export function provenanceSummary(items=[]){
 const sources=(items??[]).map(x=>x?.provenance??buildSourceProvenance(x)).filter(x=>x.url||x.title);
 return {
   schemaVersion:1,
   sourceCount:sources.length,
   uniqueHosts:new Set(sources.map(x=>x.hostname).filter(Boolean)).size,
   licenses:[...new Set(sources.map(x=>x.license?.id).filter(Boolean))],
   attributionRequired:sources.some(x=>x.attributionRequired),
   sources,
 };
}

function normalizeLicense(v){
 if(!v)return {id:'unknown',commercialUse:null,redistribution:null};
 if(typeof v==='string')return {id:v,commercialUse:null,redistribution:null};
 return {id:v.id??v.name??'unknown',commercialUse:v.commercialUse??null,redistribution:v.redistribution??null,url:v.url??null};
}
function randomId(){return globalThis.crypto?.randomUUID?.()??`src_${Date.now()}_${Math.random().toString(16).slice(2)}`}

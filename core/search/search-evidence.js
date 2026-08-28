import {sourceQualityForTask} from '../evidence/source-quality.js';
import {attachSourceProvenance} from '../provenance/source-provenance.js';
export function searchResultsToEvidence(results=[],meta={}){
  const now=meta.accessedAt??new Date().toISOString();
  return results.slice(0,10).map((r,i)=>{
    const base={id:String(r.id??`search-${meta.requestId??'result'}-${i+1}`),type:'search',title:String(r.title??''),url:String(r.url??''),publisher:r.publisher?String(r.publisher):undefined,publishedAt:r.publishedAt??null,accessedAt:now,snippet:String(r.snippet??'').slice(0,1200),relevance:clamp(r.relevance??.7),credibility:clamp(r.credibility??.5),supports:[],freshnessClass:meta.freshnessClass??null,claimKey:r.claimKey??null,claimValue:r.claimValue??null,sourceGroup:r.sourceGroup??null,upstreamSource:r.upstreamSource??null,canonicalSource:r.canonicalSource??null,isPrimarySource:r.isPrimarySource??null,sourceType:r.sourceType??null,license:r.license??null,price:r.price??null,currency:r.currency??null,shipping:r.shipping??null,availability:r.availability??null,memberOnly:r.memberOnly??false,promoEndsAt:r.promoEndsAt??null,distanceKm:r.distanceKm??null,channel:r.channel??null,product:r.product??null,barcode:r.barcode??null,brand:r.brand??null,model:r.model??null,size:r.size??null,variant:r.variant??null};
    const enriched={...base,sourceQuality:sourceQualityForTask(base,meta.task??{})};
    return attachSourceProvenance(enriched,{requestId:meta.requestId??null,queryFingerprint:meta.queryFingerprint??null,fetchedVia:meta.fetchedVia??'search_provider',accessedAt:now});
  }).filter(x=>x.url||x.title||x.snippet);
}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):.5}

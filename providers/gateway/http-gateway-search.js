import {searchResultsToEvidence} from '../../core/search/search-evidence.js';

export class HttpGatewaySearchProvider{
  constructor({gatewayUrl,fetchImpl=globalThis.fetch}={}){this.gatewayUrl=String(gatewayUrl||'').replace(/\/$/,'');this.fetchImpl=fetchImpl;}
  async search(plan){
    if(!this.gatewayUrl)throw new Error('SEARCH_GATEWAY_NOT_CONFIGURED');
    const requestId=plan?.idempotencyKey??crypto.randomUUID();
    const response=await this.fetchImpl(`${this.gatewayUrl}/v1/search`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({requestId,plan})});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||`SEARCH_HTTP_${response.status}`);if(body.requestId!==requestId)throw new Error('SEARCH_REQUEST_MISMATCH');
    return {evidence:searchResultsToEvidence(body.results??[],{requestId,freshnessClass:plan.freshnessClass,accessedAt:body.meta?.accessedAt,task:plan.taskContext??{},queryFingerprint:fingerprint(plan.query),fetchedVia:'gateway_search'}),meta:body.meta??{}};
  }
}

function fingerprint(text=''){let h=2166136261;for(const ch of String(text??'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

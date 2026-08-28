export class HttpJsonSearchProvider{
  constructor(config,{fetchImpl=globalThis.fetch,timeoutMs=15000}={}){this.config=config;this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;}
  async search(plan){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const headers={'content-type':'application/json','accept':'application/json'};if(this.config.apiKey)headers.authorization=`Bearer ${this.config.apiKey}`;
      const response=await this.fetchImpl(this.config.endpoint,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({query:plan.query,maxResults:plan.maxResults??5,language:plan.language??'auto',locale:plan.locale??null,freshnessClass:plan.freshnessClass??null,maxAgeMs:plan.maxAgeMs??null,retrievalRound:plan.retrievalRound??1,retrievalReason:plan.retrievalReason??null,preferredSourceTypes:plan.preferredSourceTypes??[],stopCondition:plan.stopCondition??null})});
      if(!response.ok){const e=new Error(`search_upstream_http_${response.status}`);e.code=`SEARCH_UPSTREAM_HTTP_${response.status}`;throw e;}
      const raw=await response.json();const rows=Array.isArray(raw)?raw:(raw.results??raw.items??[]);if(!Array.isArray(rows))throw new Error('search_results_invalid');
      return rows.map(x=>({title:x.title??'',url:x.url??x.link??'',snippet:x.snippet??x.description??'',publisher:x.publisher??x.source??null,publishedAt:x.publishedAt??x.published_at??x.date??null,relevance:x.relevance??.7,credibility:x.credibility??.5,claimKey:x.claimKey??x.claim_key??null,claimValue:x.claimValue??x.claim_value??null,sourceGroup:x.sourceGroup??x.source_group??null,upstreamSource:x.upstreamSource??x.upstream_source??null,canonicalSource:x.canonicalSource??x.canonical_source??null,isPrimarySource:x.isPrimarySource??x.is_primary_source??null}));
    }finally{clearTimeout(timer);}
  }
}

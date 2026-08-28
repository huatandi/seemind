import {HttpJsonSearchProvider} from '../providers/http-json-search.js';
export class GatewaySearchService{
  constructor({config,fetchImpl=globalThis.fetch,timeoutMs=15000,idempotency=null}={}){this.config=config;this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;this.idempotency=idempotency;}
  available(){return Boolean(this.config?.enabled&&this.config?.endpoint);}
  publicState(){return {available:this.available(),provider:this.available()?this.config.publicName:null};}
  async search(request){
    if(!request?.requestId)throw problem(400,'REQUEST_ID_REQUIRED');if(!request?.plan?.query)throw problem(400,'SEARCH_QUERY_REQUIRED');if(!this.available())throw problem(503,'SEARCH_NOT_CONFIGURED');
    const cached=this.idempotency?.get?.(`search:${request.requestId}`);if(cached)return cached;
    const plan=sanitizePlan(request.plan);const provider=new HttpJsonSearchProvider(this.config,{fetchImpl:this.fetchImpl,timeoutMs:this.timeoutMs});const results=await provider.search(plan);
    const result={requestId:request.requestId,results,meta:{accessedAt:new Date().toISOString(),provider:this.config.publicName,resultCount:results.length,idempotent:true}};return this.idempotency?.set?.(`search:${request.requestId}`,result)??result;
  }
}
function sanitizePlan(p){return {query:String(p.query).slice(0,1200),maxResults:Math.min(10,Math.max(1,Number(p.maxResults)||5)),language:String(p.language??'auto').slice(0,20),locale:p.locale?String(p.locale).slice(0,30):null,freshnessClass:p.freshnessClass??null,maxAgeMs:Number.isFinite(Number(p.maxAgeMs))?Number(p.maxAgeMs):null,retrievalRound:Math.max(1,Number(p.retrievalRound)||1),retrievalReason:p.retrievalReason?String(p.retrievalReason).slice(0,120):null,preferredSourceTypes:(p.preferredSourceTypes??[]).slice(0,8).map(x=>String(x).slice(0,40)),stopCondition:p.stopCondition?String(p.stopCondition).slice(0,160):null,taskContext:p.taskContext?{type:String(p.taskContext.type??'').slice(0,80),userIntent:String(p.taskContext.userIntent??'').slice(0,300)}:null};}
function problem(status,code){const e=new Error(code);e.status=status;e.code=code;return e;}

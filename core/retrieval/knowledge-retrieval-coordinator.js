import {evaluateRetrievalResults,buildRetrievalAnswerContract,decideEscalationAfterRetrieval} from './knowledge-retrieval-router.js';

export class KnowledgeRetrievalCoordinator{
  constructor({searchFn=null}={}){this.searchFn=searchFn}
  async run({plan,intentGraph={},safetyRisk={},worldDomain={}}={}){
    if(!plan?.shouldSearch)return {attempted:false,evaluation:{canAnswer:false,results:[]},decision:decideEscalationAfterRetrieval({retrievalPlan:plan??{},retrievalEvaluation:{canAnswer:false},intentGraph,safetyRisk})};
    if(typeof this.searchFn!=='function')return {attempted:false,errorCode:'SEARCH_UNAVAILABLE',evaluation:{canAnswer:false,results:[]},decision:decideEscalationAfterRetrieval({retrievalPlan:plan,retrievalEvaluation:{canAnswer:false},intentGraph,safetyRisk})};
    const all=[];
    for(const query of plan.queries??[]){
      const response=await this.searchFn({query,limit:5,includeImages:Boolean(plan.needsImageSearch)});
      const items=response?.results??response?.items??[];
      for(const x of items)all.push({...x,query});
    }
    const evaluation=evaluateRetrievalResults({plan,results:dedupe(all)});
    const decision=decideEscalationAfterRetrieval({retrievalPlan:plan,retrievalEvaluation:evaluation,intentGraph,safetyRisk});
    return {
      attempted:true,
      evaluation,
      decision,
      answerContract:buildRetrievalAnswerContract({evaluation,query:(plan.queries??[])[0]??'',domain:worldDomain.primary??'general'}),
    };
  }
}
function dedupe(items){const seen=new Set();return items.filter(x=>{const k=String(x.url??x.link??x.title??'');if(!k||seen.has(k))return false;seen.add(k);return true})}

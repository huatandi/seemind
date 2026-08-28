export const SEARCH_CAPABILITIES=Object.freeze({
 WEB:'web_search',
 IMAGE:'image_search',
 OFFICIAL:'official_source',
 MANUAL:'manual_documentation',
 PRODUCT:'product_model',
 LOCAL:'maps_local',
 SPECIALIST:'specialist_database',
});

export class SearchCapabilityRegistry{
 constructor({capabilities=[]}={}){
  this.capabilities=new Map();
  for(const c of capabilities)this.register(c);
 }
 register(capability){
  if(!capability?.id)throw new Error('SEARCH_CAPABILITY_ID_REQUIRED');
  this.capabilities.set(capability.id,normalize(capability));return this;
 }
 unregister(id){this.capabilities.delete(id)}
 list(){return [...this.capabilities.values()]}
 get(id){return this.capabilities.get(id)??null}
 available(){return this.list().filter(x=>x.available!==false)}
 select({plan={},task={},worldDomain={},intentGraph={},globalContext={}}={}){
  const requested=desiredTypes(plan,worldDomain,intentGraph);
  const ranked=this.available().map(c=>({...c,selectionScore:score(c,{requested,plan,task,worldDomain,intentGraph,globalContext})}))
   .filter(x=>x.selectionScore>0).sort((a,b)=>b.selectionScore-a.selectionScore||b.priority-a.priority);
  const primary=ranked[0]??null;
  const fallbacks=ranked.slice(1,4);
  return {
   schemaVersion:1,
   requested,
   primary:primary?publicCapability(primary):null,
   fallbacks:fallbacks.map(publicCapability),
   reason:primary?'best_available_capability':'no_matching_capability',
  };
 }
}

export function createDefaultSearchCapabilityRegistry({webProvider=null,imageProvider=null,officialProvider=null,manualProvider=null,productProvider=null,localProvider=null,specialistProvider=null}={}){
 return new SearchCapabilityRegistry({capabilities:[
  cap('official-source',SEARCH_CAPABILITIES.OFFICIAL,officialProvider,{priority:95,sourceTypes:['official_source','authoritative_database'],domains:['finance','document','general','product']}),
  cap('manual-docs',SEARCH_CAPABILITIES.MANUAL,manualProvider,{priority:90,sourceTypes:['manual','manufacturer'],domains:['product','document','general']}),
  cap('specialist-db',SEARCH_CAPABILITIES.SPECIALIST,specialistProvider,{priority:88,sourceTypes:['specialist_database','authoritative_database'],domains:['plant','animal','medical','general']}),
  cap('image-search',SEARCH_CAPABILITIES.IMAGE,imageProvider,{priority:84,sourceTypes:['image_search'],domains:['plant','animal','product','place','general'],supportsImages:true}),
  cap('local-maps',SEARCH_CAPABILITIES.LOCAL,localProvider,{priority:82,sourceTypes:['maps_or_local_source'],domains:['place','local','general'],supportsLocal:true}),
  cap('product-model',SEARCH_CAPABILITIES.PRODUCT,productProvider,{priority:80,sourceTypes:['manufacturer','product_database'],domains:['product','general']}),
  cap('web-search',SEARCH_CAPABILITIES.WEB,webProvider,{priority:60,sourceTypes:['current_web','search_engine','reputable_web'],domains:['*'],supportsFreshness:true}),
 ]});
}

export async function executeSearchCapabilitySelection({selection,request,registry}={}){
 const order=[selection?.primary,...(selection?.fallbacks??[])].filter(Boolean);
 const attempts=[];
 for(const selected of order){
  const c=registry.get(selected.id);if(!c?.provider?.search)continue;
  try{
   const result=await c.provider.search({...request,capabilityType:c.type});
   attempts.push({id:c.id,type:c.type,status:'completed'});
   return {status:'completed',capability:{id:c.id,type:c.type},result,attempts};
  }catch(error){
   attempts.push({id:c.id,type:c.type,status:'failed',reason:error?.code??error?.message??'SEARCH_CAPABILITY_FAILED'});
  }
 }
 return {status:'failed',reason:'ALL_SEARCH_CAPABILITIES_FAILED',attempts};
}

function cap(id,type,provider,extra){return {id,type,provider,available:Boolean(provider),...extra}}
function normalize(c){return {...c,priority:Number(c.priority??50),domains:c.domains??['*'],sourceTypes:c.sourceTypes??[],available:c.available!==false&&Boolean(c.provider)}}
function publicCapability(c){return {id:c.id,type:c.type,priority:c.priority,sourceTypes:c.sourceTypes,supportsImages:Boolean(c.supportsImages),supportsLocal:Boolean(c.supportsLocal),selectionScore:c.selectionScore}}
function desiredTypes(plan,worldDomain,intentGraph){
 const preferred=plan.preferredSources??[];const out=new Set();
 for(const s of preferred){
  if(['official_source','authoritative_database'].includes(s))out.add(SEARCH_CAPABILITIES.OFFICIAL);
  if(['manual','manufacturer'].includes(s))out.add(SEARCH_CAPABILITIES.MANUAL);
  if(s==='image_search')out.add(SEARCH_CAPABILITIES.IMAGE);
  if(s==='maps_or_local_source')out.add(SEARCH_CAPABILITIES.LOCAL);
  if(s==='specialist_database')out.add(SEARCH_CAPABILITIES.SPECIALIST);
  if(['current_web','search_engine','reputable_web'].includes(s))out.add(SEARCH_CAPABILITIES.WEB);
 }
 const domain=worldDomain.primary??'general';
 if(domain==='product')out.add(SEARCH_CAPABILITIES.PRODUCT);
 if(['plant','animal'].includes(domain))out.add(SEARCH_CAPABILITIES.SPECIALIST);
 if((intentGraph.intents??[]).some(x=>x.intent==='find')&&domain==='place')out.add(SEARCH_CAPABILITIES.LOCAL);
 if(!out.size)out.add(SEARCH_CAPABILITIES.WEB);
 return [...out];
}
function score(c,{requested,plan,worldDomain,globalContext}){
 let n=requested.includes(c.type)?100:0;
 const domain=worldDomain.primary??'general';
 if(c.domains.includes('*')||c.domains.includes(domain))n+=20;
 if(plan.needsFreshness&&c.supportsFreshness)n+=18;
 if(domain==='place'&&c.supportsLocal)n+=45;
 if(plan.needsImageSearch&&c.supportsImages)n+=30;
 if(plan.needsAuthority&&[SEARCH_CAPABILITIES.OFFICIAL,SEARCH_CAPABILITIES.MANUAL,SEARCH_CAPABILITIES.SPECIALIST].includes(c.type))n+=28;
 if((plan.preferredSources??[]).some(x=>c.sourceTypes.includes(x)))n+=25;
 const targetRegion=globalContext?.jurisdiction??globalContext?.questionRegion??globalContext?.objectRegion??null;
 if(targetRegion&&Array.isArray(c.regions)&&c.regions.length&&c.regions.includes(targetRegion))n+=22;
 if(targetRegion&&Array.isArray(c.regions)&&c.regions.length&&!c.regions.includes('*')&&!c.regions.includes(targetRegion))n-=35;
 return n+c.priority/100;
}

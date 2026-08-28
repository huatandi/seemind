const PRONOUN_PATTERNS=[
 {type:'same_object',re:/(?:它|这个|这个东西|this one|it|this|éste|esta|esto|eso|esa)/i},
 {type:'previous_object',re:/(?:刚才那个|刚才的|上一个|previous one|the one before|el anterior|la anterior)/i},
 {type:'other_object',re:/(?:那个|另一个|另外一个|that one|the other one|ese|esa|aquel|aquella)/i},
];

export function createObjectContinuityState(){return {schemaVersion:1,entities:[],focusEntityId:null,lastTurnId:null}}

export function updateObjectContinuity(state,{context=null,visualObservation=null,turnId=null}={}){
 const next=cloneState(state);
 const grounded=groundedEntities(context,visualObservation);
 for(const e of grounded)upsert(next,e);
 if(grounded.length===1)next.focusEntityId=grounded[0].id;
 else{
  const referenced=(context?.references??[]).find(r=>r.groundedRegionId);
  if(referenced){
   const hit=next.entities.find(e=>e.regionId===referenced.groundedRegionId);
   if(hit)next.focusEntityId=hit.id;
  }
 }
 next.lastTurnId=turnId??next.lastTurnId;
 return next;
}

export function resolveConversationReference({text='',state=null,currentContext=null}={}){
 const raw=String(text??'').trim();
 if(!raw||!state)return {resolved:false,reason:'NO_REFERENCE_TEXT'};
 const signal=PRONOUN_PATTERNS.find(x=>x.re.test(raw));
 if(!signal)return {resolved:false,reason:'NO_CONTINUITY_SIGNAL'};
 const currentIds=new Set((currentContext?.references??[]).filter(r=>r.groundedRegionId).map(r=>r.groundedRegionId));
 if(signal.type==='same_object'&&currentIds.size)return {resolved:false,reason:'CURRENT_VISUAL_REFERENCE_HAS_PRIORITY'};
 const entities=[...(state.entities??[])].sort((a,b)=>(b.lastSeenTurn??0)-(a.lastSeenTurn??0));
 let entity=null;
 if(signal.type==='same_object')entity=entities.find(e=>e.id===state.focusEntityId)??entities[0];
 if(signal.type==='previous_object')entity=entities.find(e=>e.id!==state.focusEntityId)??entities[1]??entities[0];
 if(signal.type==='other_object')entity=entities.find(e=>e.id!==state.focusEntityId)??null;
 if(!entity)return {resolved:false,reason:'NO_PRIOR_ENTITY'};
 return {resolved:true,referenceType:signal.type,entityId:entity.id,regionId:entity.regionId??null,label:entity.label??null,confidence:continuityConfidence(entity,state),source:'conversation_continuity'};
}

export function continuitySnapshot(state){return {focusEntityId:state?.focusEntityId??null,entities:(state?.entities??[]).map(({id,label,regionId,lastSeenTurn})=>({id,label,regionId,lastSeenTurn}))}}

function groundedEntities(ctx,visual){
 const refs=(ctx?.references??[]).filter(r=>r.groundedRegionId);
 const facts=ctx?.visual?.facts??[];
 const out=[];
 for(const r of refs){
  const label=semanticLabel(r,facts);
  out.push({id:`entity:${r.groundedRegionId}`,regionId:r.groundedRegionId,label,lastSeenTurn:turnOrdinal(ctx),evidence:['visual_grounding'],confidence:Number(r.groundingConfidence??.6)});
 }
 if(!out.length){
  const ids=facts.filter(f=>f.category==='identity'&&f.value).slice(0,3);
  for(const f of ids)out.push({id:`entity:fact:${f.id}`,regionId:null,label:String(f.value),lastSeenTurn:turnOrdinal(ctx),evidence:['visual_identity'],confidence:Number(f.confidence??.5)});
 }
 return dedupe(out);
}
function turnOrdinal(ctx){return Number(ctx?.conversationTurn??ctx?.turnIndex??0)||Date.now()}
function semanticLabel(ref,facts){
 if(ref.type==='red_indicator')return 'red indicator';
 if(ref.type==='green_indicator')return 'green indicator';
 return facts.find(f=>f.category==='identity')?.value??ref.sourceText??ref.type;
}
function upsert(state,e){const i=state.entities.findIndex(x=>x.id===e.id);if(i>=0)state.entities[i]={...state.entities[i],...e};else state.entities.push(e);state.entities=state.entities.slice(-12)}
function continuityConfidence(e,state){return Math.max(.45,Math.min(.92,Number(e.confidence??.6)-(e.id===state.focusEntityId?0:.08)))}
function dedupe(a){const m=new Map();for(const x of a)if(!m.has(x.id))m.set(x.id,x);return [...m.values()]}
function cloneState(s){return s?{...s,entities:[...(s.entities??[])].map(x=>({...x,evidence:[...(x.evidence??[])]}))}:createObjectContinuityState()}

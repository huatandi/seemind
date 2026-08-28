import {withEvidenceSemantics,assessEvidenceUsability} from './evidence-semantics.js';
export function createEvidenceGraph(input={}){
  return {
    schemaVersion:1,
    entities:[...(input.entities??[])],
    photos:[...(input.photos??[])],
    claims:[...(input.claims??[])],
    relations:[...(input.relations??[])],
    activeEntityId:input.activeEntityId??null,
    createdAt:input.createdAt??new Date().toISOString(),
    updatedAt:input.updatedAt??new Date().toISOString(),
  };
}

export function addPhotoEvidence(graph,{observation,photoId=null,userText='',timestamp=null}={}){
  const g=createEvidenceGraph(graph??{});
  const observationId=observation?.id??observation?.inputId??null;
  if(observationId){
    const existing=g.photos.find(x=>x.observationId===observationId);
    if(existing){
      const entity=g.entities.find(x=>x.id===existing.entityId)??null;
      return {graph:g,photo:existing,match:{status:'same_observation',entityId:existing.entityId,confidence:1,reasons:['observation_already_recorded']},entity};
    }
  }
  const photo=extractPhotoEvidence(observation,{photoId:photoId??randomId('photo'),userText,timestamp});
  const match=resolvePhotoEntity(g,photo,{userText});
  let entityId=match.entityId;
  if(!entityId){
    entityId=randomId('entity');
    g.entities.push({
      id:entityId,
      kind:'real_world_object',
      labels:photo.identities.map(x=>x.label),
      brand:photo.brand??null,
      model:photo.model??null,
      serial:photo.serial??null,
      confidence:photo.identities[0]?.confidence??0,
      createdAt:photo.createdAt,
      updatedAt:photo.createdAt,
    });
  }else{
    const e=g.entities.find(x=>x.id===entityId);
    if(e){
      e.labels=unique([...(e.labels??[]),...photo.identities.map(x=>x.label)]);
      e.brand=e.brand??photo.brand??null;
      e.model=e.model??photo.model??null;
      e.serial=e.serial??photo.serial??null;
      e.confidence=Math.max(Number(e.confidence??0),Number(photo.identities[0]?.confidence??0));
      e.updatedAt=photo.createdAt;
    }
  }
  photo.entityId=entityId;
  photo.relationship=match.status;
  photo.relationshipConfidence=match.confidence;
  photo.relationshipReasons=match.reasons;
  g.photos.push(photo);
  g.activeEntityId=entityId;
  g.claims.push(...photoToClaims(photo,entityId));
  g.relations.push({from:photo.id,to:entityId,type:'evidence_for',confidence:match.confidence||.65});
  g.updatedAt=new Date().toISOString();
  return {graph:g,photo,match};
}


export function buildCurrentEntityFacts(graph,entityId=graph?.activeEntityId,{now=null}={}){
  const claims=(graph?.claims??[]).filter(x=>x.entityId===entityId);
  const grouped=new Map();
  for(const claim of claims){
    const key=String(claim.type??'unknown');
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(claim);
  }
  const current={},history={},conflicts=[];
  for(const [type,items] of grouped){
    const ordered=[...items].sort((a,b)=>factTime(b)-factTime(a));
    history[type]=ordered.map(x=>factRecord(x,now));
    const usable=ordered.filter(x=>assessEvidenceUsability(x,{now:now??new Date().toISOString()}).usable);
    if(!usable.length){current[type]=null;continue}
    const newestTime=factTime(usable[0]);
    const contemporaries=usable.filter(x=>Math.abs(factTime(x)-newestTime)<=1000);
    const values=unique(contemporaries.map(x=>String(x.value??'')));
    if(values.length>1){
      current[type]=null;
      conflicts.push({type,claimIds:contemporaries.map(x=>x.id),values,reason:'CONCURRENT_ACTIVE_FACT_CONFLICT'});
      continue;
    }
    current[type]=factRecord(usable[0],now);
  }
  return {entityId,current,history,conflicts};
}

export function reconcileEntityFact(graph,{entityId=graph?.activeEntityId,type,value,source='user',timestamp=null,confidence=.85}={}){
  const g=createEvidenceGraph(graph??{});
  if(!entityId||!type||value==null)return {graph:g,claim:null,superseded:[]};
  const at=timestamp??new Date().toISOString();
  const prior=g.claims.filter(x=>x.entityId===entityId&&x.type===type&&assessEvidenceUsability(x,{now:at}).usable);
  const claim=withEvidenceSemantics({
    id:randomId('claim'),entityId,type,value,confidence,source,
  },{
    evidenceKind:source==='user'?'user_report':source==='ocr'?'ocr_extraction':source==='photo'?'observation':'inference',
    observedAt:at,assertedAt:at,confidence,
    derivedFrom:prior.map(x=>x.id),
  });
  const superseded=[];
  for(const old of prior){
    if(String(old.value??'')===String(value??''))continue;
    old.semantics={...old.semantics,lifecycleState:'superseded'};
    superseded.push(old.id);
    claim.semantics.supersedes=claim.semantics.supersedes??old.id;
  }
  g.claims.push(claim);
  g.updatedAt=new Date().toISOString();
  return {graph:g,claim,superseded};
}

function factRecord(claim,now){
  const usability=assessEvidenceUsability(claim,{now:now??new Date().toISOString()});
  return {claimId:claim.id,value:claim.value,source:claim.source??null,semantics:usability.semantics,usable:usability.usable,reasons:usability.reasons};
}
function factTime(claim){
  const s=claim?.semantics??{};
  const n=Date.parse(s.observedAt??s.assertedAt??claim?.createdAt??'');
  return Number.isFinite(n)?n:0;
}

export function resolvePhotoEntity(graph,photo,{userText=''}={}){
  const entities=graph?.entities??[];
  if(!entities.length)return {status:'new_object',entityId:null,confidence:.9,reasons:['no_existing_entity']};
  const explicitNew=/另一台|另外一台|另一个|不是这个|新的机器|different (?:device|machine)|otro equipo|otra maquina/i.test(String(userText));
  if(explicitNew)return {status:'likely_new_object',entityId:null,confidence:.98,reasons:['user_explicit_new_object']};

  const scored=entities.map(e=>scoreEntity(e,photo)).sort((a,b)=>b.score-a.score);
  const best=scored[0],second=scored[1];
  if(best.hardConflict)return {status:'likely_new_object',entityId:null,confidence:.95,reasons:best.reasons};
  if(best.score>=.82&&(best.score-(second?.score??0)>=.15||entities.length===1))
    return {status:'same_object',entityId:best.entity.id,confidence:best.score,reasons:best.reasons};
  if(best.score>=.58)
    return {status:'probably_same_object',entityId:best.entity.id,confidence:best.score,reasons:best.reasons};
  if(best.score<=.22)
    return {status:'likely_new_object',entityId:null,confidence:1-best.score,reasons:best.reasons.length?best.reasons:['insufficient_similarity']};
  return {status:'unresolved',entityId:null,confidence:.5,reasons:best.reasons.length?best.reasons:['ambiguous_cross_photo_relationship']};
}

export function buildEntityEvidenceSummary(graph,entityId=graph?.activeEntityId){
  const entity=(graph?.entities??[]).find(x=>x.id===entityId)??null;
  if(!entity)return null;
  const photos=(graph.photos??[]).filter(x=>x.entityId===entityId);
  const claims=(graph.claims??[]).filter(x=>x.entityId===entityId);
  return {
    entity,
    photoCount:photos.length,
    views:unique(photos.map(x=>x.viewType).filter(Boolean)),
    brand:firstValue(claims,'brand')??entity.brand,
    model:firstValue(claims,'model')??entity.model,
    serial:firstValue(claims,'serial')??entity.serial,
    errorCodes:unique(claims.filter(x=>x.type==='error_code').map(x=>x.value)),
    states:unique(claims.filter(x=>x.type==='state').map(x=>x.value)),
    parts:unique(claims.filter(x=>x.type==='part').map(x=>x.value)),
    textEvidence:unique(claims.filter(x=>x.type==='ocr_text').map(x=>x.value)).slice(-6),
  };
}

function extractPhotoEvidence(observation,{photoId,userText,timestamp}){
  const text=String(observation?.extractedText??'').trim();
  const general=(observation?.observations??[]).filter(x=>x.kind==='general_vision');
  const identities=general.flatMap(g=>g.identity??[]).filter(x=>x.label).sort((a,b)=>(b.confidence??0)-(a.confidence??0));
  const regions=general.flatMap(g=>g.regions??[]);
  const states=general.flatMap(g=>g.states??[]);
  const anomalies=general.flatMap(g=>g.anomalies??[]);
  const brand=matchText(text,/\b(?:brand|marca)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._ -]{1,24})/i);
  const model=matchText(text,/\b(?:model|modelo|mod\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,30})/i);
  const serial=matchText(text,/\b(?:serial|s\/n|sn|serie)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{3,40})/i);
  const errorCodes=extractErrorCodes(text);
  return {
    id:photoId,
    observationId:observation?.id??observation?.inputId??null,
    createdAt:timestamp??new Date().toISOString(),
    userText:String(userText??''),
    detectedType:observation?.detectedType??'unknown',
    identities:identities.slice(0,6),
    brand,model,serial,errorCodes,
    states:states.map(x=>x.label).filter(Boolean),
    anomalies:anomalies.map(x=>x.label).filter(Boolean),
    parts:regions.map(x=>x.objectType).filter(Boolean),
    ocrText:text.slice(0,500),
    viewType:inferViewType({text,regions,userText}),
    entityId:null,
  };
}
function scoreEntity(entity,photo){
  let score=.18,reasons=[],hardConflict=false;
  if(entity.serial&&photo.serial){
    if(eq(entity.serial,photo.serial)){score+=.75;reasons.push('serial_match')}
    else {hardConflict=true;score=0;reasons.push('serial_conflict')}
  }
  if(entity.model&&photo.model){
    if(eq(entity.model,photo.model)){score+=.48;reasons.push('model_match')}
    else {hardConflict=true;score=Math.min(score,.05);reasons.push('model_conflict')}
  }
  if(entity.brand&&photo.brand){
    if(eq(entity.brand,photo.brand)){score+=.18;reasons.push('brand_match')}
    else {score-=.2;reasons.push('brand_conflict')}
  }
  const labels=new Set((entity.labels??[]).map(norm));
  const hits=photo.identities.filter(x=>labels.has(norm(x.label)));
  if(hits.length){score+=Math.min(.28,hits[0].confidence*.25);reasons.push('visual_identity_match')}
  if(/same|同一|这台|它的|这个设备|这机器|继续|背面|铭牌|这里|这个/i.test(photo.userText)){score+=.22;reasons.push('continuity_language')}
  return {entity,score:clamp(score),hardConflict,reasons};
}
function photoToClaims(photo,entityId){
  const out=[],push=(type,value,confidence=.8)=>{if(value)out.push(withEvidenceSemantics(
    {id:randomId('claim'),entityId,photoId:photo.id,type,value,confidence,source:'photo'},
    {evidenceKind:'observation',observedAt:photo.createdAt,assertedAt:photo.createdAt,confidence}
  ))};
  push('brand',photo.brand,.92);push('model',photo.model,.94);push('serial',photo.serial,.97);
  for(const x of photo.errorCodes)push('error_code',x,.9);
  for(const x of photo.states)push('state',x,.8);
  for(const x of photo.parts)push('part',x,.72);
  if(photo.ocrText)push('ocr_text',photo.ocrText,.7);
  return out;
}
function inferViewType({text,regions,userText}){
  const s=`${text} ${userText}`;
  if(/\b(model|modelo|serial|s\/n|voltage|voltaje|marca)\b/i.test(s))return 'nameplate';
  if(/\b(error|err|c[oó]digo|code)\b/i.test(s))return 'display';
  if(/接口|插头|线缆|connector|port|cable/i.test(s))return 'connection';
  if(/这里|局部|近照|close.?up/i.test(s))return 'closeup';
  if((regions??[]).length>=3)return 'overview';
  return 'unknown_view';
}
function extractErrorCodes(text){
  const out=[];
  for(const m of String(text).matchAll(/\b(?:ERR(?:OR)?\s*[:#-]?\s*)?([A-Z]\d{1,4})\b/gi))out.push(m[1].toUpperCase());
  return unique(out);
}
function matchText(s,re){const m=String(s).match(re);return m?m[1].trim().replace(/\s{2,}/g,' '):null}
function firstValue(claims,type){return claims.find(x=>x.type===type)?.value??null}
function eq(a,b){return norm(a)===norm(b)}
function norm(s){return String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function unique(a){return [...new Set(a)]}
function clamp(n){return Math.max(0,Math.min(1,n))}
function randomId(p){return globalThis.crypto?.randomUUID?.()??`${p}_${Date.now()}_${Math.random().toString(16).slice(2)}`}

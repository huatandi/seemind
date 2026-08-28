import {createResolvedEntity,clamp01} from './entity.js';

const GENERIC_MERCHANTS=new Set(['TIENDA','STORE','SUPERMERCADO','MERCADO','RESTAURANTE','RESTAURANT','COMERCIO','CAJA','TICKET','VENTA']);

/**
 * Resolves identity from Student candidates and deterministic receipt evidence.
 * It deliberately returns uncertain/unresolved instead of inventing an entity.
 */
export function resolveEntities({observation=null,receipt=null,candidates=[]}={}){
  const pool=[...(observation?.entities??[]),...(candidates??[])].map(normalizeCandidate).filter(Boolean);
  const merchant=merchantCandidate(receipt);
  if(merchant) pool.push(merchant);
  const merged=mergeEquivalent(pool).sort((a,b)=>b.confidence-a.confidence);
  if(!merged.length)return {schemaVersion:1,primary:null,candidates:[],identityConfidence:0,conflicts:[],requiresClarification:true,reason:'no_identity_evidence'};

  const conflicts=detectConflicts(merged);
  const best=merged[0];
  const second=merged[1];
  let confidence=best.confidence;
  if(second && !equivalent(best,second) && Math.abs(best.confidence-second.confidence)<.12) confidence=Math.min(confidence,.69);
  if(conflicts.length)confidence=Math.min(confidence,.64);
  const requiresClarification=confidence<.75 || conflicts.length>0;
  const primary=createResolvedEntity({...best,confidence,conflicts,requiresClarification,candidates:merged.slice(0,5)});
  return {schemaVersion:1,primary,candidates:merged.slice(0,5),identityConfidence:primary.confidence,conflicts,requiresClarification,reason:requiresClarification?'identity_not_reliable':'identity_resolved'};
}

export function identityRequirementForTask(task={}){
  const t=String(task.type??'');
  const intent=String(task.userIntent??'').toLowerCase();
  const strictTypes=new Set(['price_search','product_comparison','troubleshooting','maintenance','instruction','product_identification']);
  const strict=strictTypes.has(t)||/(型号|model|价格|多少钱|哪里买|配件|维修|manual|说明书|compatible|兼容|part)/i.test(intent);
  return {required:strict,minConfidence:strict?.82:.65,reason:strict?'task_depends_on_exact_identity':'general_identity_context'};
}

export function identityGate(task,entityResolution){
  const req=identityRequirementForTask(task);
  if(!req.required)return {ok:true,...req};
  const primary=entityResolution?.primary;
  if(!primary)return {ok:false,...req,reason:'identity_missing'};
  if(primary.confidence<req.minConfidence)return {ok:false,...req,reason:'identity_confidence_too_low'};
  if(primary.conflicts?.length)return {ok:false,...req,reason:'identity_conflicted'};
  if(primary.requiresClarification)return {ok:false,...req,reason:'identity_requires_clarification'};
  return {ok:true,...req};
}

function merchantCandidate(receipt){
  const f=receipt?.merchant;if(!f?.value)return null;
  const name=clean(f.value);if(!name||GENERIC_MERCHANTS.has(name.toUpperCase()))return null;
  return {canonicalName:name,aliases:[name],category:'merchant',confidence:clamp01(f.confidence??0),evidenceRefs:[f.id].filter(Boolean),resolutionMethod:'receipt_merchant'};
}
function normalizeCandidate(c){
  if(!c)return null;
  const canonicalName=clean(c.canonicalName??c.name??c.label);if(!canonicalName)return null;
  return {canonicalName,category:clean(c.category)||'unknown',subtype:c.subtype??null,brand:c.brand??null,model:c.model??null,variant:c.variant??null,region:c.region??null,aliases:c.aliases??[],confidence:clamp01(c.confidence??0),evidenceRefs:c.evidenceRefs??c.sources??[],resolutionMethod:c.resolutionMethod??'student_candidate'};
}
function mergeEquivalent(items){
  const out=[];
  for(const item of items){const found=out.find(x=>equivalent(x,item));if(!found){out.push({...item,aliases:[...(item.aliases??[])]});continue}found.confidence=Math.max(found.confidence,item.confidence);found.evidenceRefs=[...new Set([...(found.evidenceRefs??[]),...(item.evidenceRefs??[])])];found.aliases=[...new Set([...(found.aliases??[]),...(item.aliases??[]),item.canonicalName])];if(!found.brand&&item.brand)found.brand=item.brand;if(!found.model&&item.model)found.model=item.model;}
  return out;
}
function equivalent(a,b){return key(a)===key(b)}
function key(x){return [clean(x.canonicalName).toLowerCase(),clean(x.brand).toLowerCase(),clean(x.model).toLowerCase()].join('|')}
function detectConflicts(items){
  const conflicts=[];if(items.length<2)return conflicts;
  const a=items[0],b=items[1];
  if(a.category===b.category && a.confidence>=.65 && b.confidence>=.65 && !equivalent(a,b)) conflicts.push(`competing_identity:${a.canonicalName}|${b.canonicalName}`);
  if(a.brand&&b.brand&&clean(a.brand).toLowerCase()!==clean(b.brand).toLowerCase()&&a.confidence>=.65&&b.confidence>=.65) conflicts.push(`brand_conflict:${a.brand}|${b.brand}`);
  if(a.model&&b.model&&clean(a.model).toLowerCase()!==clean(b.model).toLowerCase()&&a.confidence>=.65&&b.confidence>=.65) conflicts.push(`model_conflict:${a.model}|${b.model}`);
  return [...new Set(conflicts)];
}
function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}

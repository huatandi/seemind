import {buildVisualRegionEvidence} from './region-evidence.js';

export function groundLanguageReferences({observation={},references=[]}={}){
  const visual=buildVisualRegionEvidence(observation);
  const results=references.map(ref=>groundOne(ref,visual));
  const compounds=groundCompounds(references,visual);
  return {
    schemaVersion:1,
    visual,
    results,
    compounds,
    resolved:results.filter(x=>x.status==='resolved'),
    tentative:results.filter(x=>x.status==='tentative'),
    unresolved:results.filter(x=>x.status==='unresolved'),
  };
}

function groundOne(ref,visual){
  const regions=visual.regions??[];
  const candidates=scoreCandidates(ref,regions)
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||b.region.confidence-a.region.confidence);

  const best=candidates[0],second=candidates[1];
  if(!best)return unresolved(ref,'NO_REGION_EVIDENCE');
  const margin=best.score-(second?.score??0);
  const uniqueStrong=best.score>=.8&&(margin>=.2||!second);
  const uniqueModerate=best.score>=.6&&(margin>=.25||!second);
  const status=uniqueStrong?'resolved':uniqueModerate?'tentative':'unresolved';
  return {
    reference:{...ref},
    status,
    regionId:status==='unresolved'?null:best.region.id,
    bbox:status==='unresolved'?null:best.region.bbox,
    confidence:status==='resolved'?Math.min(.98,best.score):status==='tentative'?Math.min(.78,best.score):0,
    candidates:candidates.slice(0,5).map(x=>({regionId:x.region.id,score:round(x.score),text:x.region.text||null,objectType:x.region.objectType,bbox:x.region.bbox})),
    reason:status==='resolved'?'UNIQUE_REGION_EVIDENCE':status==='tentative'?'AMBIGUOUS_BUT_PLAUSIBLE':'AMBIGUOUS_REGION_EVIDENCE',
  };
}

function scoreCandidates(ref,regions){
  const ordinal=ordinalIndex(ref?.type);
  if(ordinal){
    const ordered=orderedOrdinalRegions(regions);
    if(!ordered)return [];
    const target=ordered[ordinal-1];
    return target?[{region:target,score:.92}]:[];
  }
  return regions.map(region=>({region,score:score(ref,region)}));
}
function score(ref,region){
  const t=ref?.type??'',n=region.bbox?.normalized;
  let s=0;
  if(t==='right_side'&&n){const cx=n.x+n.width/2;if(cx>=.60)s+=.78;else if(cx>=.5)s+=.45}
  if(t==='left_side'&&n){const cx=n.x+n.width/2;if(cx<=.40)s+=.78;else if(cx<=.5)s+=.45}
  if(t==='upper_area'&&n){const cy=n.y+n.height/2;if(cy<=.40)s+=.78;else if(cy<=.5)s+=.45}
  if(t==='lower_area'&&n){const cy=n.y+n.height/2;if(cy>=.60)s+=.78;else if(cy>=.5)s+=.45}
  if(t==='displayed_code'){
    if((region.tags??[]).includes('error_code'))s+=.9;
    else if((region.tags??[]).includes('number_or_code'))s+=.66;
  }
  if(t==='red_indicator'){
    if((region.tags??[]).includes('indicator'))s+=.55;
    if((region.tags??[]).includes('color:red'))s+=.45;
  }
  if(t==='green_indicator'){
    if((region.tags??[]).includes('indicator'))s+=.55;
    if((region.tags??[]).includes('color:green'))s+=.45;
  }
  if(t==='this_object'){
    if(region.regionType==='object'||region.objectType)s+=.65;
  }
  if(t==='this_region'||t==='that_region'){
    // Without pointing coordinates/deictic gesture we cannot safely select a generic region.
    s+=0;
  }
  if(t==='two_objects'){
    s+=0;
  }
  return Math.min(1,s*Math.max(.65,Number(region.confidence)||.65));
}
function ordinalIndex(type){
  const m=String(type??'').match(/^ordinal_([1-9])$/);
  return m?Number(m[1]):0;
}
function orderedOrdinalRegions(regions){
  const items=(regions??[]).filter(r=>r.regionType==='object'||r.objectType).filter(r=>r.bbox?.normalized);
  if(items.length<2)return null;
  const centers=items.map(r=>({r,cx:r.bbox.normalized.x+r.bbox.normalized.width/2,cy:r.bbox.normalized.y+r.bbox.normalized.height/2}));
  const xs=centers.map(x=>x.cx),ys=centers.map(x=>x.cy);
  const xSpan=Math.max(...xs)-Math.min(...xs),ySpan=Math.max(...ys)-Math.min(...ys);
  const avgW=items.reduce((s,r)=>s+r.bbox.normalized.width,0)/items.length;
  const avgH=items.reduce((s,r)=>s+r.bbox.normalized.height,0)/items.length;
  // Only infer ordinal order when the objects form a clearly dominant row or
  // column and their centers are separated by at least about one object size.
  // Detector array order is never treated as user-visible order.
  if(xSpan>=Math.max(.08,avgW)&&xSpan>=ySpan*1.6)return centers.sort((a,b)=>a.cx-b.cx).map(x=>x.r);
  if(ySpan>=Math.max(.08,avgH)&&ySpan>=xSpan*1.6)return centers.sort((a,b)=>a.cy-b.cy).map(x=>x.r);
  return null;
}
function unresolved(ref,reason){return {reference:{...ref},status:'unresolved',regionId:null,bbox:null,confidence:0,candidates:[],reason}}
function round(n){return Math.round(n*100)/100}

function groundCompounds(references,visual){
  const spatial=references.filter(r=>['right_side','left_side','upper_area','lower_area'].includes(r.type));
  const semantic=references.filter(r=>['red_indicator','green_indicator','displayed_code'].includes(r.type));
  const ordinals=references.filter(r=>ordinalIndex(r.type));
  const out=[];

  // Existing same-region spatial + semantic grounding.
  for(const a of spatial)for(const b of semantic){
    const ranked=(visual.regions??[]).map(region=>{
      const sa=score(a,region),sb=score(b,region);
      if(sa<=0||sb<=0)return {region,score:0};
      return {region,score:Math.min(1,(sa+sb)/2+.18)};
    }).filter(x=>x.score>0).sort((x,y)=>y.score-x.score||y.region.confidence-x.region.confidence);
    out.push(compoundResult([a,b],ranked,'COMBINED_SPATIAL_SEMANTIC_EVIDENCE'));
  }

  // Hierarchical grounding: first select a plausible parent/container from
  // spatial language, then resolve an ordinal only among children inside it.
  for(const a of spatial)for(const o of ordinals){
    const parent=uniqueParentForSpatial(a,visual.regions??[]);
    if(!parent)continue;
    const children=containedObjectRegions(parent.region,visual.regions??[]);
    const explicitChildren=children.filter(r=>r.parentId===parent.region.id);
    const ordered=orderedChildRegions(explicitChildren.length>=2?explicitChildren:children);
    const target=ordered?.[ordinalIndex(o.type)-1]??null;
    if(!target){
      out.push(unresolvedCompound([a,o],'PARENT_SCOPED_ORDINAL_UNRESOLVED',parent.region.id));
      continue;
    }
    out.push({
      referenceTypes:[a.type,o.type],
      sourceTexts:[a.sourceText,o.sourceText],
      status:'resolved',
      regionId:target.id,
      bbox:target.bbox,
      confidence:Math.min(.94,(parent.score+.92)/2),
      candidates:[{regionId:target.id,score:.92,text:target.text||null,objectType:target.objectType,bbox:target.bbox}],
      reason:'PARENT_SCOPED_ORDINAL_EVIDENCE',
      parentRegionId:parent.region.id,
      relation:'inside',
    });
  }
  return out.filter(Boolean);
}

function compoundResult(refs,ranked,resolvedReason){
  const best=ranked[0],second=ranked[1];
  if(!best)return unresolvedCompound(refs,'COMBINED_EVIDENCE_INSUFFICIENT');
  const margin=best.score-(second?.score??0);
  const status=best.score>=.85&&(margin>=.18||!second)?'resolved':best.score>=.65&&(margin>=.2||!second)?'tentative':'unresolved';
  return {
    referenceTypes:refs.map(x=>x.type),sourceTexts:refs.map(x=>x.sourceText),
    status,regionId:status==='unresolved'?null:best.region.id,bbox:status==='unresolved'?null:best.region.bbox,
    confidence:status==='resolved'?Math.min(.98,best.score):status==='tentative'?Math.min(.78,best.score):0,
    candidates:ranked.slice(0,5).map(x=>({regionId:x.region.id,score:round(x.score),text:x.region.text||null,objectType:x.region.objectType,bbox:x.region.bbox})),
    reason:status==='resolved'?resolvedReason:status==='tentative'?'COMBINED_EVIDENCE_AMBIGUOUS':'COMBINED_EVIDENCE_INSUFFICIENT',
  };
}
function unresolvedCompound(refs,reason,parentRegionId=null){
  return {referenceTypes:refs.map(x=>x.type),sourceTexts:refs.map(x=>x.sourceText),status:'unresolved',regionId:null,bbox:null,confidence:0,candidates:[],reason,parentRegionId};
}
function uniqueParentForSpatial(ref,regions){
  const candidates=(regions??[])
    .filter(r=>isContainerRegion(r))
    .map(region=>({region,score:score(ref,region)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||b.region.confidence-a.region.confidence);
  const best=candidates[0],second=candidates[1];
  if(!best||best.score<.6)return null;
  // Spatial parent selection may tie with children located in the same side.
  // Prefer the containing region only when it geometrically contains the
  // competing candidate; otherwise the parent itself is ambiguous.
  if(second&&best.score-second.score<.2){
    const top=candidates.filter(x=>best.score-x.score<.2);
    const containing=top.filter(x=>top.some(y=>y!==x&&inside(x.region.bbox?.normalized,y.region.bbox?.normalized)));
    if(!containing.length)return null;
    containing.sort((a,b)=>bboxArea(b.region.bbox?.normalized)-bboxArea(a.region.bbox?.normalized));
    const chosen=containing[0],runner=containing[1];
    // Two similarly large, equally spatial parents remain ambiguous.
    if(runner&&bboxArea(runner.region.bbox?.normalized)>=bboxArea(chosen.region.bbox?.normalized)*.8)return null;
    return chosen;
  }
  return best;
}
function isContainerRegion(r){
  if(!r?.bbox?.normalized)return false;
  if((r.tags??[]).includes('container'))return true;
  const t=String(r.objectType??'').toLowerCase();
  return /device|box|panel|router|machine|appliance|vehicle|screen|module/.test(t);
}
function containedObjectRegions(parent,regions){
  return (regions??[]).filter(r=>{
    if(r.id===parent.id||!(r.regionType==='object'||r.objectType))return false;
    if(r.parentId&&r.parentId!==parent.id)return false;
    if(!r.parentId&&!inside(parent.bbox?.normalized,r.bbox?.normalized))return false;
    // Nested peer containers are not ordinal children. Small semantic parts
    // (indicator/port/button/etc.) remain eligible even when their type name
    // happens to contain a broad device term.
    const pt=String(r.objectType??'').toLowerCase();
    if(/indicator|led|light|port|button|connector|switch|slot|component|part/.test(pt))return true;
    return !isContainerRegion(r);
  });
}
function orderedChildRegions(regions){
  const parts=(regions??[]).filter(r=>/indicator|led|light|port|button|connector|switch|slot|component|part/i.test(String(r.objectType??'')));
  return orderedOrdinalRegions(parts.length>=2?parts:regions);
}
function bboxArea(b){return b?b.width*b.height:0}
function inside(parent,child){
  if(!parent||!child)return false;
  const cx=child.x+child.width/2,cy=child.y+child.height/2;
  return cx>=parent.x&&cx<=parent.x+parent.width&&cy>=parent.y&&cy<=parent.y+parent.height;
}


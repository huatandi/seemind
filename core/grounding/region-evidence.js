export function buildVisualRegionEvidence(observation={}){
  const ocr=findObservation(observation,'ocr');
  const prep=findObservation(observation,'image_preprocessing');
  const width=Number(prep?.width)||null,height=Number(prep?.height)||null;
  const explicit=(observation?.observations??[]).filter(x=>x.kind==='visual_regions').flatMap(x=>x.regions??[]);
  const general=(observation?.observations??[]).filter(x=>x.kind==='general_vision').flatMap(g=>(g.regions??[]).map(r=>({...r,source:r.source??g.providerId??'general-vision'})));
  const regions=[
    ...(ocr?.blocks??[]).map((b,i)=>fromOcrBlock(b,i,{width,height})).filter(Boolean),
    ...explicit.map((r,i)=>normalizeRegion(r,`region-${i+1}`,{width,height})).filter(Boolean),
    ...general.map((r,i)=>normalizeRegion(r,`general-region-${i+1}`,{width,height})).filter(Boolean),
  ];
  return {
    schemaVersion:1,
    image:{width,height},
    regions:dedupeRegions(regions),
    capabilities:{
      ocrTextRegions:regions.some(x=>x.source==='ocr'),
      semanticObjectRegions:regions.some(x=>x.source!=='ocr'&&(x.tags?.length||x.objectType)),
      colorRegions:regions.some(x=>(x.tags??[]).some(t=>/^color:/i.test(t))),
    },
  };
}

export function normalizeBbox(bbox,{width=null,height=null}={}){
  if(!bbox)return null;
  let x,y,w,h;
  if(Array.isArray(bbox)&&bbox.length===4)[x,y,w,h]=bbox.map(Number);
  else if(typeof bbox==='object'){x=Number(bbox.x);y=Number(bbox.y);w=Number(bbox.width);h=Number(bbox.height)}
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return null;
  const normalized=(x<=1&&y<=1&&w<=1&&h<=1);
  const nx=normalized?x:(width?x/width:null),ny=normalized?y:(height?y/height:null);
  const nw=normalized?w:(width?w/width:null),nh=normalized?h:(height?h/height:null);
  return {
    x,y,width:w,height:h,
    normalized:nx!=null&&ny!=null&&nw!=null&&nh!=null?{x:clamp(nx),y:clamp(ny),width:clamp(nw),height:clamp(nh)}:null,
  };
}

function fromOcrBlock(b,i,dims){
  const bbox=normalizeBbox(b?.bbox,dims);if(!bbox)return null;
  const text=String(b?.text??'').trim();if(!text)return null;
  return {
    id:String(b.id??`ocr-block-${i+1}`),
    source:'ocr',
    regionType:'text',
    objectType:null,
    text,
    confidence:Number(b.confidence??0)||0,
    bbox,
    tags:inferTextTags(text),
  };
}
function normalizeRegion(r,id,dims){
  const bbox=normalizeBbox(r?.bbox,dims);if(!bbox)return null;
  return {
    id:String(r?.id??id),
    source:String(r?.source??'vision'),
    regionType:String(r?.regionType??r?.type??'object'),
    objectType:r?.objectType?String(r.objectType):null,
    parentId:r?.parentId?String(r.parentId):null,
    text:String(r?.text??''),
    confidence:Number(r?.confidence??0)||0,
    bbox,
    tags:[...(r?.tags??[])].map(String),
  };
}
function inferTextTags(text){
  const tags=['text'];
  if(/\d/.test(text))tags.push('contains_number');
  if(/^[\d\s.,:$A-Z-]+$/i.test(text)&&/\d/.test(text))tags.push('number_or_code');
  if(/\b(?:ERROR|ERR|E\d{1,4}|F\d{1,4})\b/i.test(text))tags.push('error_code');
  return tags;
}
function dedupeRegions(a){
  const m=new Map();for(const x of a){const key=`${x.source}|${x.id}`;if(!m.has(key))m.set(key,x)}return [...m.values()];
}
function findObservation(o,kind){return (o?.observations??[]).find(x=>x.kind===kind)}
function clamp(n){return Math.max(0,Math.min(1,n))}

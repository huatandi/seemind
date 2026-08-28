const BARCODE_KINDS=new Set(['ean_13','ean_8','upc_a','upc_e','itf','code_128','unknown']);

export function buildExactProductIdentity({barcodeObservation=null,extractedText='',visionIdentities=[],hints={}}={}){
 const barcodes=normalizeBarcodes(barcodeObservation);
 const text=normalizeText(extractedText);
 const parsed=parsePackageText(text);
 const vision=normalizeVision(visionIdentities);
 const conflicts=[];
 const barcode=chooseBarcode(barcodes,conflicts);
 const brand=chooseTextOrVision(parsed.brand,vision,'brand',conflicts);
 const model=chooseTextOrVision(parsed.model,vision,'model',conflicts);
 const size=parsed.size??null;
 const variant=parsed.variant??null;
 const evidence=[
   ...(barcode?[ev('barcode',barcode.value,1,barcode.format)]:[]),
   ...(brand?[ev('brand',brand.value,brand.confidence,brand.source)]:[]),
   ...(model?[ev('model',model.value,model.confidence,model.source)]:[]),
   ...(size?[ev('size',size,.88,'ocr')]:[]),
   ...(variant?[ev('variant',variant,.72,'ocr')]:[]),
 ];
 const exactSignals=[barcode,model,size].filter(Boolean).length;
 const confidence=round(Math.min(.99,
   (barcode?.value?.length? .55:0)+(model?.value?.length?.3:0)+(size?.2:0)+(brand?.value?.length?.12:0)+(variant?.1:0)
 ));
 const exact=Boolean(barcode)||Boolean(model&&(brand||size))||exactSignals>=2;
 const missing=[];
 if(!barcode)missing.push('barcode');
 if(!brand)missing.push('brand');
 if(!model)missing.push('model');
 if(!size)missing.push('size');
 return {
   schemaVersion:1,kind:'exact_product_identity',
   status:conflicts.length?'conflicted':exact&&confidence>=.72?'exact_candidate':'partial',
   exact,confidence,
   identity:{barcode:barcode?.value??null,barcodeFormat:barcode?.format??null,brand:brand?.value??null,model:model?.value??null,size,variant,
     market:hints.market??null},
   evidence,conflicts,missing,
   searchKey:buildSearchKey({barcode:barcode?.value,brand:brand?.value,model:model?.value,size,variant}),
   policy:{
     barcodeIsStrongIdentifier:true,
     visionAloneCannotAssertExactVariant:true,
     conflictBlocksSilentMerge:true,
     exactIdentityRequiredBeforePriceComparison:true,
   },
 };
}

function normalizeBarcodes(o){
 const items=Array.isArray(o)?o:(o?.items??[]);
 return items.map(x=>({value:String(x.rawValue??x.value??'').trim(),format:String(x.format??'unknown').toLowerCase()}))
  .filter(x=>x.value&&isProductCode(x.value,x.format));
}
function isProductCode(v,format){
 const digits=v.replace(/\D/g,'');
 if(['ean_13','ean_8','upc_a','upc_e'].includes(format))return [8,12,13].includes(digits.length)&&validGtin(digits);
 if(BARCODE_KINDS.has(format)&&[8,12,13,14].includes(digits.length))return validGtin(digits);
 return false;
}
function validGtin(s){
 if(!/^\d{8,14}$/.test(s))return false;
 let sum=0,pos=0;
 for(let i=s.length-2;i>=0;i--,pos++)sum+=Number(s[i])*(pos%2===0?3:1);
 return (10-sum%10)%10===Number(s.at(-1));
}
function chooseBarcode(list,conflicts){
 const unique=[...new Map(list.map(x=>[x.value,x])).values()];
 if(unique.length>1)conflicts.push({field:'barcode',values:unique.map(x=>x.value),reason:'MULTIPLE_VALID_PRODUCT_CODES'});
 return unique.length===1?unique[0]:null;
}
function parsePackageText(text){
 const brand=match(text,/(?:brand|marca)\s*[:#-]?\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9&.' -]{1,24}?)(?=\s+(?:model|modelo|mod\.?|size|contenido|cont\.?|variant|variante|sabor|flavor|tipo)\b|$)/i);
 const model=match(text,/(?:model|modelo|mod\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,30})/i);
 const size=match(text,/\b(\d+(?:[.,]\d+)?\s?(?:ml|mL|l|L|g|kg|oz|fl\.?\s?oz|lb|ct|pcs|pzas?|piezas?))\b/i);
 const variant=match(text,/(?:variant|variante|sabor|flavor|tipo)\s*[:#-]?\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9&.' -]{1,32})/i);
 return {brand,model,size,variant};
}
function normalizeVision(v){
 return (v??[]).map(x=>({label:String(x.label??x.value??'').trim(),type:String(x.type??x.field??'identity'),confidence:Number(x.confidence??0)})).filter(x=>x.label);
}
function chooseTextOrVision(textValue,vision,field,conflicts){
 const candidates=[];
 if(textValue)candidates.push({value:textValue,confidence:.9,source:'ocr'});
 for(const x of vision)if(x.type===field)candidates.push({value:x.label,confidence:x.confidence,source:'vision'});
 const groups=new Map();
 for(const x of candidates){const k=canon(x.value);if(!groups.has(k)||groups.get(k).confidence<x.confidence)groups.set(k,x)}
 if(groups.size>1)conflicts.push({field,values:[...groups.values()].map(x=>x.value),reason:'OCR_VISION_DISAGREEMENT'});
 return [...groups.values()].sort((a,b)=>b.confidence-a.confidence)[0]??null;
}
function buildSearchKey(x){return [x.barcode,x.brand,x.model,x.size,x.variant].filter(Boolean).join(' ').trim()||null}
function normalizeText(s){return String(s??'').replace(/\s+/g,' ').trim()}
function match(s,r){return s.match(r)?.[1]?.trim()??null}
function canon(s){return String(s).toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g,'')}
function ev(field,value,confidence,source){return {field,value,confidence,source}}
function round(n){return Math.round(Number(n)*1000)/1000}

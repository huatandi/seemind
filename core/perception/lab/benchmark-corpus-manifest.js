export const CORPUS_SCHEMA_VERSION=1;

export function validateCorpusManifest(manifest={}){
 const errors=[],warnings=[],ids=new Set();
 const cases=Array.isArray(manifest.cases)?manifest.cases:[];
 for(const [i,c] of cases.entries()){
   if(!c?.id)errors.push(`CASE_${i}_MISSING_ID`);
   else if(ids.has(c.id))errors.push(`DUPLICATE_CASE_ID:${c.id}`);else ids.add(c.id);
   if(!['vision','voice','multimodal'].includes(c?.modality))errors.push(`CASE_${c?.id??i}_INVALID_MODALITY`);
   if(!c?.assetRef)errors.push(`CASE_${c?.id??i}_MISSING_ASSET_REF`);
   if(c?.modality==='vision'&&!c?.category)errors.push(`CASE_${c?.id??i}_MISSING_CATEGORY`);
   if(c?.modality==='voice'&&!c?.expected?.text)warnings.push(`CASE_${c?.id??i}_NO_TRANSCRIPT`);
   if(c?.modality==='multimodal'&&!c?.expected?.target)warnings.push(`CASE_${c?.id??i}_NO_TARGET`);
 }
 return {schemaVersion:CORPUS_SCHEMA_VERSION,valid:errors.length===0,errors,warnings,cases:cases.length};
}

export function createCorpusCase({id,modality,assetRef,category=null,language='auto',expected={},conditions={},tags=[]}={}){
 return {id,modality,assetRef,category,language,expected,conditions,tags:[...tags]};
}

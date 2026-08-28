export function createFact({id,category,name,value=null,unit=null,confidence=0,status=null,evidence=[],provenance={},conflicts=[]}={}){
  if(!id)throw new Error('FACT_ID_REQUIRED');
  return {
    schemaVersion:1,
    id:String(id),
    category:String(category??'unknown'),
    name:String(name??id),
    value:value??null,
    unit:unit??null,
    confidence:clamp01(confidence),
    status:status??(value==null?'unresolved':'resolved'),
    evidence:normalizeEvidence(evidence),
    conflicts:[...(conflicts??[])].map(safeConflict),
    provenance:{
      source:String(provenance.source??'student'),
      parserId:provenance.parserId??null,
      documentType:provenance.documentType??null,
      derived:Boolean(provenance.derived),
    },
  };
}

export function factFromField(field,{id,category,name,unit=null,parserId=null,documentType=null}={}){
  return createFact({
    id:id??field?.field??name,
    category,name:name??field?.field??id,
    value:field?.value??null,
    unit,
    confidence:field?.confidence??0,
    status:field?.status??(field?.value==null?'unresolved':'resolved'),
    evidence:field?[{
      sourceText:field.sourceText??'',
      rule:field.rule??'UNKNOWN',
      rawValue:field.rawValue??null,
      normalizedValue:field.normalizedValue??field.value??null,
      bbox:field.bbox??null,
    }]:[],
    provenance:{source:field?.source??'local',parserId,documentType,derived:String(field?.rule??'').includes('DERIVED')},
    conflicts:[],
  });
}

function normalizeEvidence(items){
  return (items??[]).map(x=>({
    sourceText:String(x?.sourceText??''),
    rule:String(x?.rule??'UNKNOWN'),
    rawValue:x?.rawValue??null,
    normalizedValue:x?.normalizedValue??null,
    bbox:x?.bbox??null,
  }));
}
function safeConflict(x){
  if(!x||typeof x!=='object')return {id:String(x),status:'conflicted'};
  return {
    id:String(x.id??'unknown'),
    status:String(x.status??'conflicted'),
    expectedMinor:Number.isFinite(Number(x.expectedMinor))?Number(x.expectedMinor):null,
    actualMinor:Number.isFinite(Number(x.actualMinor))?Number(x.actualMinor):null,
    deltaMinor:Number.isFinite(Number(x.deltaMinor))?Number(x.deltaMinor):null,
  };
}
function clamp01(n){n=Number(n);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}

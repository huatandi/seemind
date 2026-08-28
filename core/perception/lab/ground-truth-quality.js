export function auditGroundTruth(cases=[]){
 const issues=[];
 for(const c of cases){
  const e=c.expected??{};
  if(c.modality==='vision'&&!(e.labels??[]).filter(Boolean).length)issues.push({id:c.id,severity:'blocking',code:'VISION_LABELS_EMPTY'});
  if(c.modality==='voice'&&!String(e.text??'').trim())issues.push({id:c.id,severity:'blocking',code:'VOICE_TRANSCRIPT_EMPTY'});
  if(c.modality==='multimodal'){
   if(!String(e.target??'').trim())issues.push({id:c.id,severity:'blocking',code:'MULTIMODAL_TARGET_EMPTY'});
   if(!String(e.intent??'').trim())issues.push({id:c.id,severity:'warning',code:'MULTIMODAL_INTENT_EMPTY'});
  }
 }
 return {schemaVersion:1,cases:cases.length,blocking:issues.filter(x=>x.severity==='blocking').length,warnings:issues.filter(x=>x.severity==='warning').length,issues,usable:!issues.some(x=>x.severity==='blocking')};
}

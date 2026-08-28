import {normalizeEvidenceSemantics} from './evidence-semantics.js';
export function fieldEvidence(field,value,options={}){
  const {
    rawValue=null, normalizedValue=value, source='local', sourceText='', confidence=0,
    rule='UNRESOLVED', bbox=null, candidates=[]
  }=options;
  const normalizedConfidence=clamp01(confidence);
  return {
    schemaVersion:1,field,value,rawValue,normalizedValue,source,sourceText,
    confidence:normalizedConfidence,rule,bbox,candidates,
    status:value==null?'unresolved':'resolved',correctedByUser:false,
    semantics:normalizeEvidenceSemantics({source,confidence:normalizedConfidence,rule},{
      evidenceKind:source==='user'?'user_report':source==='ocr'?'ocr_extraction':'inference',
      confidence:normalizedConfidence,
    }),
  };
}
function clamp01(n){n=Number(n);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}

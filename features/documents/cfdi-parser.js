import {textField} from './parser-utils.js';

export function parseCfdiDocument(text=''){
  const fields={
    issuerRfc:textField(text,'issuerRfc',[/RFC(?:\s+EMISOR)?\s*:?\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i],{confidence:.96,rule:'RFC_MATCH',normalize:v=>String(v).toUpperCase()}),
    receiverRfc:textField(text,'receiverRfc',[/RFC(?:\s+RECEPTOR)\s*:?\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i],{confidence:.96,rule:'RFC_MATCH',normalize:v=>String(v).toUpperCase()}),
    uuid:textField(text,'uuid',[/FOLIO\s+FISCAL\s*:?\s*([0-9A-F-]{30,40})/i,/\bUUID\s*:?\s*([0-9A-F-]{30,40})/i],{confidence:.98,rule:'UUID_MATCH',normalize:v=>String(v).toUpperCase()}),
    fiscalRegime:textField(text,'fiscalRegime',[/R[EÉ]GIMEN\s+FISCAL\s*:?\s*([^\n]+)/i],{confidence:.88,rule:'FISCAL_REGIME_MATCH'}),
    cfdiUse:textField(text,'cfdiUse',[/USO\s+CFDI\s*:?\s*([A-Z0-9]{2,5}(?:\s*-\s*[^\n]+)?)/i],{confidence:.9,rule:'CFDI_USE_MATCH'}),
  };
  return {parserId:'cfdi-v1',fields,checks:[]};
}

import {fieldEvidence} from '../../core/evidence/field-evidence.js';

const STOP=/\b(RFC|TOTAL|SUBTOTAL|IVA|EFECTIVO|CAMBIO|DESCUENTO|DESC|PAGO|PAGÓ|TARJETA|CR[EÉ]DITO|D[EÉ]BITO|TICKET|FOLIO|CAJA|FECHA|HORA|R[EÉ]GIMEN|DOMICILIO|TEL|CLIENTE|PERMISO|LUGAR\s+DE\s+EXPEDICI[ÓO]N)\b/i;
const SLOGAN=/\b(?:GRACIAS|BIENVENIDO|VUELVA\s+PRONTO|SU\s+COMPRA|ATENCI[ÓO]N|ORIGINAL\s+CLIENTE)\b/i;
const LEGAL_SUFFIX=/\b(?:S\.?\s*A\.?\s+DE\s+C\.?\s*V\.?|S\.?\s+DE\s+R\.?\s*L\.?|S\.?\s*A\.?\s*P\.?\s*I\.?|A\.?\s*C\.?)\b/i;
const KNOWN_BRANDS=[
  [/\bOXXO\b/i,'OXXO'],
  [/\bEL\s+FLORIDO\b/i,'EL FLORIDO'],
  [/\bWALMART\b/i,'WALMART'],
  [/\bSORIANA\b/i,'SORIANA'],
  [/\bCALIMAX\b/i,'CALIMAX'],
  [/\bCOSTCO\b/i,'COSTCO'],
];

export function analyzeMerchantIdentity(lines=[],receiptType='unknown'){
  const candidates=collectCandidates(lines);
  const brandCandidates=candidates.filter(x=>x.kind==='brand'||x.kind==='header');
  const legalCandidates=candidates.filter(x=>x.kind==='legal_entity');

  const brand=chooseBrand(brandCandidates);
  const legalEntity=legalCandidates.sort(rank)[0]??null;
  const fallback=candidates.sort(rank)[0]??null;
  const chosen=brand??fallback;

  const merchant=!chosen||chosen.score<3
    ?fieldEvidence('merchant',null,{rule:'UNRESOLVED',confidence:0,candidates})
    :fieldEvidence('merchant',chosen.value,{
      sourceText:chosen.sourceText,
      confidence:confidenceFor(chosen,candidates),
      rule:chosen.kind==='brand'?'KNOWN_BRAND_MATCH':chosen.kind==='legal_entity'?'LEGAL_ENTITY_HEADER':'MERCHANT_HEADER_SCORE',
      candidates,
    });

  return {
    merchant,
    brand:brand?{value:brand.value,confidence:confidenceFor(brand,candidates),sourceText:brand.sourceText}:null,
    legalEntity:legalEntity?{value:legalEntity.value,confidence:confidenceFor(legalEntity,candidates),sourceText:legalEntity.sourceText}:null,
    relationship:brand&&legalEntity&&brand.value!==legalEntity.value?'brand_and_legal_entity':'single_identity',
    receiptType,
    candidates,
  };
}

export function resolveMerchantIntelligence(lines=[],receiptType='unknown'){
  return analyzeMerchantIdentity(lines,receiptType).merchant;
}

function collectCandidates(lines){
  const candidates=[];
  for(const line of lines.slice(0,14)){
    const s=line.clean;
    if(!s||STOP.test(s)||SLOGAN.test(s)||/^\d/.test(s))continue;
    if(!/[A-ZÁÉÍÓÚÑ]{3,}/i.test(s))continue;
    let score=0;const reasons=[];
    const known=KNOWN_BRANDS.find(([re])=>re.test(s));
    const isLegal=LEGAL_SUFFIX.test(s);
    if(known){score+=8;reasons.push('known_brand')}
    if(isLegal){score+=5;reasons.push('legal_entity')}
    if(line.index<=2){score+=3;reasons.push('top_header')}
    else if(line.index<=6){score+=1;reasons.push('upper_header')}
    if(/\b(?:OPERADORA|COMERCIALIZADORA|SERVICIOS|RESTAURANTE|ESTACI[ÓO]N|TIENDA|SUPERMERCADO)\b/i.test(s)){score+=2;reasons.push('merchant_term')}
    if(/\b(?:CALLE|BLVD|AV\.?|CARRETERA|COL\.?|FRACC|C\.?P\.?)\b/i.test(s)){score-=3;reasons.push('address_like')}
    const value=isLegal?cleanMerchantName(s):(known?.[1]??cleanMerchantName(s));
    if(value.length<3)continue;
    candidates.push({
      value,sourceText:line.raw,lineIndex:line.index,score,reasons,
      kind:isLegal?'legal_entity':known?'brand':'header'
    });
  }
  return candidates;
}

function chooseBrand(candidates){
  const known=candidates.filter(x=>x.kind==='brand').sort(rank)[0];
  if(known)return known;
  // Prefer a short top display header over a later legal entity only when it has
  // merchant wording or a clear top-header advantage.
  return candidates.filter(x=>x.kind==='header'&&x.lineIndex<=2&&x.score>=3).sort(rank)[0]??null;
}
function rank(a,b){return b.score-a.score||a.lineIndex-b.lineIndex}
function confidenceFor(x,all){
  const sorted=[...all].sort(rank),idx=sorted.indexOf(x);
  const competitor=sorted.find((_,i)=>i!==idx);
  const margin=x.score-(competitor?.score??0);
  return Math.min(.97,Math.max(.45,.48+x.score*.045+Math.max(0,margin)*.025));
}
function cleanMerchantName(s){return String(s).replace(/\s{2,}/g,' ').replace(/\s+(?:RFC|TEL|FECHA)\b.*$/i,'').trim()}

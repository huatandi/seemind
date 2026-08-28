import {fieldEvidence} from '../../core/evidence/field-evidence.js';
import {buildReceiptIntelligence,applyEvidenceConfidence,buildIvaRateChecks} from './receipt-intelligence-v2.js';
import {classifyReceiptType,receiptTypeFieldPolicy} from './receipt-type-intelligence.js';
import {analyzeMerchantIdentity} from './merchant-intelligence.js';
import {routeSpecializedDocument} from '../documents/document-router.js';
import {buildUniversalStructuredFacts} from '../../core/facts/universal-facts.js';

const MONTHS = {
  ENE:1,ENERO:1,FEB:2,FEBRERO:2,MAR:3,MARZO:3,ABR:4,ABRIL:4,MAY:5,MAYO:5,
  JUN:6,JUNIO:6,JUL:7,JULIO:7,AGO:8,AGOSTO:8,SEP:9,SEPT:9,SEPTIEMBRE:9,
  OCT:10,OCTUBRE:10,NOV:11,NOVIEMBRE:11,DIC:12,DICIEMBRE:12,
};

export function parseReceiptText(text='') {
  const rawText = String(text ?? '');
  const lines = buildReceiptLines(rawText);
  const subtotal = resolveMoneyField(lines, 'subtotalMinor', [/\bSUB\s*TOTAL(?=\s|:|\$|MXN|MN|\d|$)/i]);
  const tax = resolveMoneySumField(lines, 'taxMinor', [/\bIVA(?:\s+\d{1,2}(?:[.,]\d+)?\s*%)?(?=\s|:|\$|MXN|MN|\d|$)/i]);
  const discount = resolveMoneySumField(lines, 'discountMinor', [/\b(?:DESCUENTO|DESC\.?)\b/i]);
  const total = resolveMoneyField(lines, 'totalMinor', [/(?:^|\s)TOTAL(?=\s|:|\$|MXN|MN|\d|$)/i], {exclude:[/SUB\s*TOTAL/i,/TOTAL\s+DE\s+ART[IÍ]CULOS/i,/TOTAL\s+ART[IÍ]CULOS/i,/TOTAL\s+PARCIAL/i]});
  const cash = resolveMoneyField(lines, 'cashMinor', [/\bEFECTIVO(?=\s|:|\$|MXN|MN|\d|$)/i,/\bUSTED\s+PAG[OÓ](?=\s|:|\$|MXN|MN|\d|$)/i], {exclude:[/TARJETA|CR[EÉ]DITO|D[EÉ]BITO/i]});
  const change = resolveMoneyField(lines, 'changeMinor', [/\bCAMBIO(?=\s|:|\$|MXN|MN|\d|$)/i]);
  const date = resolveDate(lines);
  const receiptType = classifyReceiptType(rawText,{lines});
  const merchantIdentity = analyzeMerchantIdentity(lines,receiptType.type);
  const merchant = merchantIdentity.merchant;

  recoverCurrencySymbolMisreadAsFive(total,{cash,change,subtotal,tax,discount});

  const checks = [];
  if (total.value != null && cash.value != null && change.value != null) {
    const expected = cash.value - change.value;
    const delta = Math.abs(expected - total.value);
    checks.push({
      id:'cash-change-total',
      status: delta <= 1 ? 'supported' : 'conflicted',
      expectedMinor: expected,
      actualMinor: total.value,
      deltaMinor: delta,
    });
  }
  if (subtotal.value != null && tax.value != null && total.value != null) {
    const expected = subtotal.value + tax.value - (discount.value ?? 0);
    const delta = Math.abs(expected - total.value);
    checks.push({
      id:'subtotal-tax-total',
      status: delta <= 2 ? 'supported' : 'conflicted',
      expectedMinor: expected,
      actualMinor: total.value,
      deltaMinor: delta,
      discountMinor: discount.value ?? 0,
    });
  }

  checks.push(...buildIvaRateChecks({lines,subtotal,tax}));

  // Evidence may raise/lower confidence, but never rewrites a resolved field.
  applyEvidenceConfidence({merchant,date,subtotal,tax,discount,total,cash,change},checks);

  const intelligence=buildReceiptIntelligence({
    lines,
    fields:{merchant,date,subtotal,tax,discount,total,cash,change},
    checks,
  });
  intelligence.receiptType={...receiptType,fieldPolicy:receiptTypeFieldPolicy(receiptType.type)};
  intelligence.merchantIdentity=merchantIdentity;

  const specialized=routeSpecializedDocument({
    text:rawText,
    receiptType,
    baseReceipt:{merchant,date,subtotal,tax,discount,total,cash,change},
  });
  intelligence.specializedDocument=specialized;

  const facts=buildUniversalStructuredFacts({
    merchant,date,subtotal,tax,discount,total,cash,change,receiptType,specialized,checks,intelligence
  });
  intelligence.structuredFacts=facts;

  return { merchant, date, subtotal, tax, discount, total, cash, change, receiptType, specialized, facts, checks, intelligence, rawText };
}

function recoverCurrencySymbolMisreadAsFive(total,{cash,change,subtotal,tax,discount}){
  if(total?.value==null||!total.rawValue||/[\$]|MXN|MN/i.test(total.rawValue))return;
  const raw=String(total.rawValue).trim().replace(/\s/g,'');
  if(!/^5\d+[.,]\d{2}$/.test(raw))return;
  const stripped=parseLocalizedAmount(raw.slice(1));
  if(stripped==null)return;
  const expected=[];
  if(cash?.value!=null&&change?.value!=null)expected.push(cash.value-change.value);
  if(subtotal?.value!=null&&tax?.value!=null)expected.push(subtotal.value+tax.value-(discount?.value??0));
  const supportsRecovered=expected.some(v=>Math.abs(v-stripped)<=1);
  const supportsOriginal=expected.some(v=>Math.abs(v-total.value)<=1);
  if(!supportsRecovered||supportsOriginal)return;
  total.value=stripped;
  total.normalizedValue=(stripped/100).toFixed(2);
  total.rule='SEMANTIC_CURRENCY_5_RECOVERY';
  total.confidence=Math.max(total.confidence,.96);
  total.recovery={from:raw,to:total.normalizedValue,reason:'Leading 5 is consistent with a misread currency symbol and independent arithmetic evidence'};
}


function resolveMoneySumField(lines, field, patterns, {exclude=[]}={}) {
  const candidates=[];
  for (const line of lines) {
    if (!patterns.some(re=>re.test(line.clean))) continue;
    if (exclude.some(re=>re.test(line.clean))) continue;
    const values = extractMoneyCandidates(line.clean);
    const bestForLine = values.at(-1);
    if(bestForLine)candidates.push({...bestForLine,lineIndex:line.index,sourceText:line.raw});
  }
  if (!candidates.length) return fieldEvidence(field,null,{rule:'UNRESOLVED',confidence:0,candidates});
  const sum=candidates.reduce((acc,x)=>acc+x.minor,0);
  return fieldEvidence(field,sum,{
    sourceText:candidates.map(x=>x.sourceText).join(' | '),
    confidence:candidates.length>1?0.94:0.92,
    rule:candidates.length>1?'MULTI_LABEL_SUM':'LABEL_AMOUNT_MATCH',
    rawValue:candidates.map(x=>x.raw).join(' + '),
    normalizedValue:(sum/100).toFixed(2),
    candidates
  });
}

function buildReceiptLines(rawText=''){
  const physical=String(rawText??'').split(/\r?\n/);
  const expanded=[];
  for(const raw of physical){
    const clean=normalizeLine(raw);
    if(!clean)continue;
    for(const part of splitKnownLabels(clean)){
      expanded.push({raw:part,index:expanded.length,clean:part,moneyCandidates:extractMoneyCandidates(part)});
    }
  }
  return expanded;
}

function splitKnownLabels(line=''){
  // OCR frequently glues summary rows into one line. Insert boundaries only before
  // strong receipt labels. The negative letter lookbehind prevents TOTAL inside SUBTOTAL.
  const label='SUB\\s*TOTAL|TOTAL\\s+DE\\s+ART[IÍ]CULOS|TOTAL\\s+ART[IÍ]CULOS|TOTAL\\s+PARCIAL|TOTAL|IVA|DESCUENTO|DESC\\.?|EFECTIVO|USTED\\s+PAG[OÓ]|CAMBIO|FECHA';
  const re=new RegExp(`(?<![A-ZÁÉÍÓÚÑ])(?=(${label}))`,'gi');
  return String(line).replace(re,'\n').split(/\n/).map(x=>normalizeLine(x)).filter(Boolean);
}

function resolveMoneyField(lines, field, patterns, {exclude=[]}={}) {
  const candidates=[];
  for (const line of lines) {
    if (!patterns.some(re=>re.test(line.clean))) continue;
    if (exclude.some(re=>re.test(line.clean))) continue;
    const values = extractMoneyCandidates(line.clean);
    for (const candidate of values) {
      candidates.push({...candidate,lineIndex:line.index,sourceText:line.raw});
    }
  }
  const best = candidates.at(-1);
  if (!best) return fieldEvidence(field,null,{rule:'UNRESOLVED',confidence:0,candidates});
  return fieldEvidence(field,best.minor,{sourceText:best.sourceText,confidence:0.92,rule:'LABEL_AMOUNT_MATCH',rawValue:best.raw,normalizedValue:best.normalized,candidates});
}

export function extractMoneyCandidates(line='') {
  const results=[];
  // Supports $656.38, 656,38, 1,234.56, OCR-lost currency symbol, MXN/MN suffix.
  const re=/(?:\$|MXN\s*|MN\s*)?\s*(\d{1,3}(?:[ ,.]\d{3})*[.,]\d{2}|\d{1,7}[.,]\d{2})(?:\s*(?:MXN|MN))?/gi;
  for (const m of String(line).matchAll(re)) {
    const parsed = parseLocalizedAmount(m[1]);
    if (parsed != null) results.push({raw:m[0].trim(),normalized:(parsed/100).toFixed(2),minor:parsed});
  }
  return results;
}

export function parseLocalizedAmount(raw) {
  let s=String(raw).trim().replace(/\s/g,'');
  if (!s) return null;
  const lastComma=s.lastIndexOf(','), lastDot=s.lastIndexOf('.');
  const decimalSep=lastComma>lastDot?',':'.';
  const thousandsSep=decimalSep===','?'.':',';
  s=s.split(thousandsSep).join('');
  if(decimalSep===',') s=s.replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)?Math.round(n*100):null;
}

function resolveDate(lines){
  for(const line of lines){
    const s=line.clean;
    let m=s.match(/\b(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](20\d{2})\b/);
    if(m){const iso=toIso(+m[3],+m[2],+m[1]);if(iso)return fieldEvidence('date',iso,{sourceText:line.raw,confidence:.9,rule:'DMY_DATE_MATCH'});}
    m=s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if(m){const iso=toIso(+m[1],+m[2],+m[3]);if(iso)return fieldEvidence('date',iso,{sourceText:line.raw,confidence:.95,rule:'ISO_DATE_MATCH'});}
    m=s.match(/\b(\d{1,2})\s*(?:DE\s+)?(ENE(?:RO)?|FEB(?:RERO)?|MAR(?:ZO)?|ABR(?:IL)?|MAY(?:O)?|JUN(?:IO)?|JUL(?:IO)?|AGO(?:STO)?|SEP|SEPT(?:IEMBRE)?|OCT(?:UBRE)?|NOV(?:IEMBRE)?|DIC(?:IEMBRE)?)(?:\s+DE)?\s*(20\d{2})\b/i);
    if(m){const iso=toIso(+m[3],MONTHS[m[2].toUpperCase()],+m[1]);if(iso)return fieldEvidence('date',iso,{sourceText:line.raw,confidence:.93,rule:'SPANISH_MONTH_DATE_MATCH'});}
  }
  return fieldEvidence('date',null,{rule:'UNRESOLVED',confidence:0});
}

function resolveMerchant(lines){
  const stop=/\b(RFC|TOTAL|SUBTOTAL|IVA|EFECTIVO|CAMBIO|DESCUENTO|DESC|PAGO|PAGÓ|TARJETA|CR[EÉ]DITO|D[EÉ]BITO|TICKET|FOLIO|CAJA|FECHA|HORA|REGIMEN|DOMICILIO|TEL)\b/i;
  const candidates=lines.slice(0,8).filter(l=>!stop.test(l.clean)&&/[A-ZÁÉÍÓÚÑ]{3,}/i.test(l.clean)&&!/^\d/.test(l.clean));
  if(!candidates.length)return fieldEvidence('merchant',null,{rule:'UNRESOLVED',confidence:0});
  // Merchant is only a candidate, not treated as certain without stronger evidence.
  const best=candidates[0];
  return fieldEvidence('merchant',best.clean,{sourceText:best.raw,confidence:.55,rule:'HEADER_CANDIDATE',candidates:candidates.map(x=>x.clean)});
}

function normalizeLine(s){return String(s).normalize('NFKC').replace(/[|]/g,'I').replace(/\s+/g,' ').trim();}
function toIso(y,m,d){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}

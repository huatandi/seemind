const FINANCIAL_LABEL=/\b(?:SUB\s*TOTAL|TOTAL|IVA|EFECTIVO|CAMBIO|DESCUENTO|DESC\.?|PAGO|PAGÓ)\b/i;

export function normalizeOcrText(input='',{locale=null}={}){
  const rawText=String(input??'');
  const transformations=[];
  let text=rawText.normalize('NFKC')
    .replace(/\r\n?/g,'\n')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .replace(/[ \t]+/g,' ');
  if(text!==rawText)record(transformations,'UNICODE_WHITESPACE_NORMALIZATION',rawText,text,.99);

  text=repairSplitLabels(text,transformations);
  text=repairConfusedLabels(text,transformations);
  text=repairMoneyGlyphs(text,transformations);
  text=dedupeSafeAdjacentLines(text,transformations);

  const normalizedText=text.split('\n').map(x=>x.trim()).filter(Boolean).join('\n');
  return {
    schemaVersion:1,locale,rawText,normalizedText,
    changed:normalizedText!==rawText.trim(),
    transformations,
    confidence:transformations.length?Math.min(...transformations.map(x=>x.confidence)):1,
  };
}

function repairSplitLabels(text,events){
  let out=text;
  const rules=[
    {re:/\bS\s*U\s*B\s*T\s*O\s*T\s*A\s*L\b/gi,to:'SUBTOTAL',id:'JOIN_SUBTOTAL_LABEL'},
    {re:/\bT\s*O\s*T\s*A\s*L\b/gi,to:'TOTAL',id:'JOIN_TOTAL_LABEL'},
    {re:/\bE\s*F\s*E\s*C\s*T\s*I\s*V\s*O\b/gi,to:'EFECTIVO',id:'JOIN_EFECTIVO_LABEL'},
    {re:/\bC\s*A\s*M\s*B\s*I\s*O\b/gi,to:'CAMBIO',id:'JOIN_CAMBIO_LABEL'},
    {re:/\bI\s*V\s*A\b/gi,to:'IVA',id:'JOIN_IVA_LABEL'},
  ];
  for(const r of rules)out=replaceTracked(out,r.re,r.to,r.id,.98,events);
  // Very common OCR line break: "SUB\nTOTAL 100.00". Restrict to this exact label pair.
  out=replaceTracked(out,/\bSUB\s*\n\s*TOTAL\b/gi,'SUBTOTAL','JOIN_BROKEN_SUBTOTAL_LINE',.98,events);
  return out;
}

function repairConfusedLabels(text,events){
  let out=text;
  const rules=[
    {re:/\bSUBT[O0]TAL\b/gi,to:'SUBTOTAL',id:'LABEL_O0_SUBTOTAL',confidence:.97},
    {re:/\bT[O0]TAL\b/gi,to:'TOTAL',id:'LABEL_O0_TOTAL',confidence:.97},
    {re:/\bTOTA[I1L]\b/gi,to:'TOTAL',id:'LABEL_IL1_TOTAL',confidence:.94},
    {re:/\b[I1L]VA\b/gi,to:'IVA',id:'LABEL_IL1_IVA',confidence:.94},
    {re:/\bCAMB[I1L][O0]\b/gi,to:'CAMBIO',id:'LABEL_IL10_CAMBIO',confidence:.93},
    {re:/\bEFECT[I1L]V[O0]\b/gi,to:'EFECTIVO',id:'LABEL_IL10_EFECTIVO',confidence:.93},
  ];
  for(const r of rules)out=replaceTracked(out,r.re,r.to,r.id,r.confidence,events);
  return out;
}

function repairMoneyGlyphs(text,events){
  // Only repair O/I/l inside an amount-shaped token that already has a decimal separator
  // and two decimal glyphs. This prevents global "O→0" corruption of merchant/product text.
  const re=/(?<![A-ZÁÉÍÓÚÑ])(?:\$|MXN\s*|MN\s*)?[\s]*[0-9OIl]{1,7}(?:[ ,.][0-9OIl]{3})*[.,][0-9OIl]{2}(?:\s*(?:MXN|MN))?(?![A-ZÁÉÍÓÚÑ])/gi;
  return text.replace(re,m=>{
    const repaired=m.replace(/[O]/gi,'0').replace(/[Il]/g,'1');
    if(repaired!==m)record(events,'AMOUNT_GLYPH_OIL_TO_01',m,repaired,.93);
    return repaired;
  });
}

function dedupeSafeAdjacentLines(text,events){
  const lines=String(text).split('\n');
  const out=[];
  for(const line of lines){
    const clean=line.trim();
    const prev=out.at(-1)?.trim();
    // Financial lines can legitimately repeat (multiple IVA/discount rows), never auto-delete them.
    if(clean&&prev&&clean===prev&&!FINANCIAL_LABEL.test(clean)){
      record(events,'ADJACENT_DUPLICATE_NONFINANCIAL_LINE',clean,'',.9);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function replaceTracked(text,re,to,rule,confidence,events){
  return text.replace(re,(m)=>{
    if(m===to)return m;
    record(events,rule,m,to,confidence);
    return to;
  });
}
function record(events,rule,before,after,confidence){
  events.push({rule,before:compact(before),after:compact(after),confidence});
}
function compact(v){const s=String(v??'').replace(/\s+/g,' ').trim();return s.length>160?s.slice(0,157)+'...':s}

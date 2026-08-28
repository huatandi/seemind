const PROFILES=[
  {
    id:'bank_transfer',
    label:'bank_transfer',
    indicators:[
      [/\b(?:SPEI|CLABE|CLAVE\s+DE\s+RASTREO|TRANSFERENCIA|BANCO\s+RECEPTOR|BANCO\s+EMISOR)\b/i,4,'banking'],
      [/\b(?:CUENTA|BENEFICIARIO|ORDENANTE|REFERENCIA)\b/i,1,'banking_context'],
    ],
    conflicts:[/\bTOTAL\s+DE\s+ART[IÍ]CULOS\b/i],
  },
  {
    id:'cfdi_invoice',
    label:'cfdi_invoice',
    indicators:[
      [/\b(?:CFDI|UUID|FOLIO\s+FISCAL|SELLO\s+DIGITAL|SAT|R[EÉ]GIMEN\s+FISCAL|USO\s+CFDI)\b/i,4,'cfdi'],
      [/\bRFC\b/i,1,'rfc'],
    ],
  },
  {
    id:'gas_station',
    label:'gas_station',
    indicators:[
      [/\b(?:PERMISO\s+C\.?R\.?E\.?|LITROS?|MAGNA|PREMIUM|DIESEL|GASOLINA|ESTACI[ÓO]N\s+DE\s+SERVICIO)\b/i,4,'fuel'],
      [/\b(?:PRECIO\s+POR\s+LITRO|VOLUMEN)\b/i,3,'fuel_detail'],
    ],
  },
  {
    id:'restaurant',
    label:'restaurant',
    indicators:[
      [/\b(?:PROPINA|MESA|MESERO|COMENSALES|SERVICIO)\b/i,3,'restaurant'],
      [/\b(?:RESTAURANTE|CAF[EÉ]|TAQUER[IÍ]A|TACOS)\b/i,2,'restaurant_name'],
    ],
  },
  {
    id:'convenience_store',
    label:'convenience_store',
    indicators:[
      [/\bOXXO\b/i,5,'known_brand'],
      [/\b(?:TIENDA\s+DE\s+CONVENIENCIA|RECARGA|SERVICIOS?)\b/i,1,'convenience'],
    ],
  },
  {
    id:'retail_receipt',
    label:'retail_receipt',
    indicators:[
      [/\bTOTAL\s+DE\s+ART[IÍ]CULOS\b/i,3,'item_count'],
      [/\b(?:SUBTOTAL|IVA|EFECTIVO|CAMBIO)\b/i,1,'receipt_summary'],
      [/\b(?:ART[IÍ]CULOS?|CAJA|CAJERO|TICKET)\b/i,1,'retail_context'],
    ],
  },
];

export function classifyReceiptType(text='',{lines=[]}={}){
  const source=String(text??'');
  const scored=PROFILES.map(p=>{
    let score=0;const evidence=[];
    for(const [re,weight,reason] of p.indicators){
      const matches=source.match(re);
      if(matches){score+=weight;evidence.push({reason,weight,match:matches[0]})}
    }
    for(const re of p.conflicts??[])if(re.test(source))score-=2;
    return {type:p.label,score,evidence};
  }).sort((a,b)=>b.score-a.score);

  const top=scored[0]??{type:'unknown',score:0,evidence:[]};
  const second=scored[1]??{score:0};
  const margin=top.score-second.score;
  if(top.score<3)return {type:'unknown',confidence:0,evidence:[],candidates:scored.slice(0,3)};
  const confidence=round(Math.min(.98,.55+top.score*.06+Math.max(0,margin)*.04),2);
  return {type:top.type,confidence,evidence:top.evidence,candidates:scored.slice(0,3)};
}

export function receiptTypeFieldPolicy(type){
  const common={merchant:'optional',date:'important',total:'important'};
  if(type==='bank_transfer')return {...common,subtotal:'not_expected',tax:'not_expected',cash:'not_expected',change:'not_expected'};
  if(type==='cfdi_invoice')return {...common,subtotal:'important',tax:'important',cash:'optional',change:'not_expected'};
  if(type==='gas_station')return {...common,subtotal:'optional',tax:'important',cash:'optional',change:'optional'};
  if(type==='restaurant')return {...common,subtotal:'important',tax:'important',cash:'optional',change:'optional'};
  if(type==='convenience_store'||type==='retail_receipt')return {...common,subtotal:'important',tax:'important',cash:'optional',change:'optional'};
  return common;
}

function round(n,d=2){const p=10**d;return Math.round(n*p)/p}

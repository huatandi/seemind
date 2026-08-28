const RFC=/\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/gi;
const CURP=/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi;
const EMAIL=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE=/(?<!\d)(?:\+?52[\s.-]?)?(?:\d[\s.-]?){10}(?!\d)/g;
const CARD=/\b(?:\d[ -]*?){13,19}\b/g;

export function scanReceiptTextForSensitiveData(text=''){
  const s=String(text),findings=[];
  collect(findings,'rfc',s,RFC);
  collect(findings,'curp',s,CURP);
  collect(findings,'email',s,EMAIL);
  collect(findings,'phone',s,PHONE);
  for(const m of s.matchAll(CARD)){
    const digits=m[0].replace(/\D/g,'');
    if(luhn(digits))findings.push({type:'payment_card',start:m.index,end:m.index+m[0].length,preview:mask(digits)});
  }
  return findings;
}
export function redactReceiptText(text=''){
  const findings=scanReceiptTextForSensitiveData(text).sort((a,b)=>b.start-a.start);
  let out=String(text);
  for(const f of findings)out=out.slice(0,f.start)+`[REDACTED_${f.type.toUpperCase()}]`+out.slice(f.end);
  return {text:out,findings,count:findings.length};
}
function collect(out,type,s,re){re.lastIndex=0;for(const m of s.matchAll(re))out.push({type,start:m.index,end:m.index+m[0].length,preview:'***'})}
function luhn(s){if(s.length<13||s.length>19)return false;let sum=0,alt=false;for(let i=s.length-1;i>=0;i--){let n=+s[i];if(alt&&(n*=2)>9)n-=9;sum+=n;alt=!alt}return sum%10===0}
function mask(s){return `${'*'.repeat(Math.max(0,s.length-4))}${s.slice(-4)}`}

import {fieldEvidence} from '../../core/evidence/field-evidence.js';

export function textField(text,field,patterns,{confidence=.9,group=1,rule='LABEL_TEXT_MATCH',normalize=v=>String(v).trim()}={}){
  for(const re of patterns){
    const m=String(text).match(re);
    if(m?.[group]!=null){
      const value=normalize(m[group]);
      if(value!==''&&value!=null)return fieldEvidence(field,value,{sourceText:m[0],confidence,rule,rawValue:m[group],normalizedValue:value});
    }
  }
  return fieldEvidence(field,null,{rule:'UNRESOLVED',confidence:0});
}
export function numberField(text,field,patterns,{confidence=.9,group=1,rule='LABEL_NUMBER_MATCH'}={}){
  return textField(text,field,patterns,{confidence,group,rule,normalize:v=>{
    const n=Number(String(v).replace(',','.').replace(/[^\d.]/g,''));
    return Number.isFinite(n)?n:null;
  }});
}
export function moneyField(text,field,patterns,{confidence=.9,group=1,rule='LABEL_MONEY_MATCH'}={}){
  return textField(text,field,patterns,{confidence,group,rule,normalize:v=>{
    let s=String(v).trim().replace(/\s/g,'').replace(/[$A-Z]/gi,'');
    const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.');
    const decimal=lastComma>lastDot?',':'.',thousands=decimal===','?'.':',';
    s=s.split(thousands).join(''); if(decimal===',')s=s.replace(',','.');
    const n=Number(s); return Number.isFinite(n)?Math.round(n*100):null;
  }});
}
export function lastDigits(value,count=4){
  const digits=String(value??'').replace(/\D/g,'');
  return digits?digits.slice(-count):null;
}

import {RECEIPT_GT_FIELDS} from './ground-truth-schema.js';
import {annotationProgress,confirmAnnotationField} from './annotation-workflow.js';

export const ANNOTATION_FIELD_LABELS={
  merchant:'COMERCIO',
  date:'FECHA',
  subtotal:'SUBTOTAL',
  tax:'IVA',
  discount:'DESCUENTO',
  total:'TOTAL',
  cash:'EFECTIVO',
  change:'CAMBIO',
};

export function annotationConsoleRows(draft){
  return RECEIPT_GT_FIELDS.map(field=>{
    const current=draft?.fields?.[field]??{};
    return {
      field,
      label:ANNOTATION_FIELD_LABELS[field]??field,
      value:current.value??null,
      status:current.status??'unresolved',
      suggestion:current.suggestion??null,
      isMoney:['subtotal','tax','discount','total','cash','change'].includes(field),
      critical:['date','total'].includes(field),
      confirmed:current.status==='confirmed',
    };
  });
}

export function acceptSuggestion(draft,field,{annotatorId=null}={}){
  const suggestion=draft?.fields?.[field]?.suggestion;
  if(!suggestion||suggestion.value==null)throw new Error(`NO_SUGGESTION:${field}`);
  return confirmAnnotationField(draft,field,{value:suggestion.value,status:'confirmed',annotatorId});
}

export function applyConsoleValue(draft,field,displayValue,{annotatorId=null}={}){
  const row=annotationConsoleRows(draft).find(x=>x.field===field);
  if(!row)throw new Error(`UNKNOWN_GROUND_TRUTH_FIELD:${field}`);
  const value=parseDisplayValue(displayValue,{isMoney:row.isMoney});
  return confirmAnnotationField(draft,field,{value,status:'confirmed',annotatorId});
}

export function markNotApplicable(draft,field,{annotatorId=null}={}){
  return confirmAnnotationField(draft,field,{value:null,status:'not_applicable',annotatorId});
}

export function formatGroundTruthValue(field,value){
  if(value==null)return '';
  if(['subtotal','tax','discount','total','cash','change'].includes(field))return (Number(value)/100).toFixed(2);
  return String(value);
}

export function annotationConsoleSummary(draft){
  const p=annotationProgress(draft);
  const criticalReady=['date','total'].every(k=>draft?.fields?.[k]?.status!=='unresolved');
  return {...p,criticalReady};
}

function parseDisplayValue(v,{isMoney=false}={}){
  const s=String(v??'').trim();
  if(!s)return null;
  if(!isMoney)return s;
  const normalized=s.replace(/\s/g,'').replace(/[$A-Z]/gi,'');
  const lastComma=normalized.lastIndexOf(','),lastDot=normalized.lastIndexOf('.');
  const sep=lastComma>lastDot?',':'.';
  let num=normalized;
  if(lastComma>=0&&lastDot>=0){
    const thousands=sep===','?'.':',';
    num=num.split(thousands).join('');
  }
  if(sep===',')num=num.replace(',','.');
  const n=Number(num);
  if(!Number.isFinite(n))throw new Error(`INVALID_MONEY_VALUE:${v}`);
  return Math.round(n*100);
}

import {semanticLabelScore} from './benchmark-metrics.js';

export function scoreVisionBenchmarkCase({case:c,result}={}){
 const expected=c?.expected?.labels??[];
 const predicted=extractVisualLabels(result);
 const quality=semanticLabelScore(expected,predicted);
 return {
  ok:Boolean(predicted.length||!expected.length),
  quality,
  details:{expected:[...expected],predicted},
 };
}

export function extractVisualLabels(result={}){
 const out=[];
 collect(out,result?.identity,'label');
 collect(out,result?.scene,'label');
 collect(out,result?.states,'label');
 collect(out,result?.labels,null);
 if(result?.label)out.push(result.label);
 if(result?.text)out.push(result.text);
 for(const o of result?.observations??[]){
   collect(out,o?.identity,'label');collect(out,o?.scene,'label');collect(out,o?.states,'label');
   if(o?.kind==='ocr'&&o.rawText)out.push(o.rawText);
 }
 return [...new Set(out.map(x=>String(x??'').trim()).filter(Boolean))];
}
function collect(out,value,key){
 if(!Array.isArray(value))return;
 for(const x of value){const v=key?x?.[key]:x;if(v!=null)out.push(v)}
}

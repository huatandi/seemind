import {wordErrorRate,semanticLabelScore,intentAccuracy} from './benchmark-metrics.js';

export function createPerceptionLabSuite({visionCases=[],voiceCases=[]}={}){
 return {
   schemaVersion:1,
   visionCases:visionCases.map(normalizeVisionCase),
   voiceCases:voiceCases.map(normalizeVoiceCase),
   principle:'Benchmark real user tasks: first useful understanding, correctness, robustness and latency.',
 };
}

export async function runVisionLab({suite,engine,now=()=>performanceNow(),onCase=null}={}){
 const rows=[];
 for(const c of suite.visionCases){
   const started=now();
   try{
     const out=await engine.infer(c.input,{capability:c.capability,prompt:c.prompt,language:c.language});
     const result=out?.result??out;
     const latencyMs=now()-started;
     const labels=extractLabels(result);
     const quality=semanticLabelScore(c.expectedLabels,labels);
     const row={id:c.id,ok:true,latencyMs,quality,labels,result};
     rows.push(row);onCase?.(row);
   }catch(error){
     const row={id:c.id,ok:false,latencyMs:now()-started,quality:0,errorCode:String(error?.code??error?.message??'VISION_CASE_FAILED')};
     rows.push(row);onCase?.(row);
   }
 }
 return summarize(rows,'vision');
}

export async function runVoiceLab({suite,engine,onCase=null}={}){
 const rows=[];
 for(const c of suite.voiceCases){
   const started=Date.now();
   try{
     const out=await engine.transcribeCase?.(c.input,{language:c.language})??await engine.listenCase?.(c.input,{language:c.language});
     const text=String(out?.text??out??'');
     const wer=wordErrorRate(c.expectedText,text);
     const predictedIntent=out?.intent??c.intentExtractor?.(text)??null;
     const iacc=c.expectedIntent?intentAccuracy(c.expectedIntent,predictedIntent):null;
     const row={id:c.id,ok:true,latencyMs:Date.now()-started,wer,intentAccuracy:iacc,quality:1-Math.min(1,wer),text};
     rows.push(row);onCase?.(row);
   }catch(error){
     const row={id:c.id,ok:false,latencyMs:Date.now()-started,wer:1,intentAccuracy:0,quality:0,errorCode:String(error?.code??error?.message??'VOICE_CASE_FAILED')};
     rows.push(row);onCase?.(row);
   }
 }
 return summarize(rows,'voice');
}

function summarize(rows,modality){
 const good=rows.filter(x=>x.ok);
 const lat=good.map(x=>x.latencyMs).sort((a,b)=>a-b);
 const qualities=good.map(x=>x.quality).filter(Number.isFinite);
 const intents=good.map(x=>x.intentAccuracy).filter(Number.isFinite);
 const wers=good.map(x=>x.wer).filter(Number.isFinite);
 return {
   schemaVersion:1,modality,cases:rows.length,successRate:rows.length?good.length/rows.length:0,
   avgQuality:avg(qualities),avgWer:avg(wers),intentAccuracy:avg(intents),
   p50LatencyMs:pct(lat,.5),p95LatencyMs:pct(lat,.95),rows,
 };
}
function normalizeVisionCase(c){return {id:c.id,capability:c.capability??'general_vision',input:c.input,prompt:c.prompt??'Describe the image.',language:c.language??'auto',expectedLabels:[...(c.expectedLabels??[])]}}
function normalizeVoiceCase(c){return {id:c.id,input:c.input,language:c.language??'auto',expectedText:String(c.expectedText??''),expectedIntent:c.expectedIntent??null,intentExtractor:c.intentExtractor??null}}
function extractLabels(r){
 const out=[];
 for(const x of r?.identity??[])if(x.label)out.push(x.label);
 for(const x of r?.scene??[])if(x.label)out.push(x.label);
 if(r?.label)out.push(r.label);
 if(Array.isArray(r?.labels))out.push(...r.labels);
 if(r?.text)out.push(r.text);
 return out;
}
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function pct(a,p){if(!a.length)return null;return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]}
function performanceNow(){return globalThis.performance?.now?.()??Date.now()}

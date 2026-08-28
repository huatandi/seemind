const VISION_SCENARIOS=['low_light','blur','far_distance','multi_object','small_target','text_interference','occlusion'];
const VOICE_SCENARIOS=['shop_noise','street_noise','vehicle_noise','far_mic','mixed_language','numbers','brand_model'];

export function detectRuntimeScenarios({modality,triage=null,userQuestion='',language='auto',hints={}}={}){
 const out=[];
 if(modality==='vision'){
  const v=triage?.visual??{};
  if(Number(v.brightRatio??1)<.16)out.push('low_light');
  if(hints.blur===true)out.push('blur');
  if(hints.farDistance===true)out.push('far_distance');
  if(hints.multiObject===true)out.push('multi_object');
  if(hints.smallTarget===true)out.push('small_target');
  if(triage?.ocrMode==='support')out.push('text_interference');
  if(hints.occlusion===true)out.push('occlusion');
 }
 if(modality==='voice'){
  const q=String(userQuestion??'');
  if(hints.shopNoise===true)out.push('shop_noise');
  if(hints.streetNoise===true)out.push('street_noise');
  if(hints.vehicleNoise===true)out.push('vehicle_noise');
  if(hints.farMic===true)out.push('far_mic');
  if(hints.mixedLanguage===true||/[,+/]/.test(String(language))||/mixed/i.test(String(language)))out.push('mixed_language');
  if(/\d|金额|多少钱|价格|total|importe|precio|amount/i.test(q))out.push('numbers');
  if(/型号|品牌|model|modelo|marca|brand/i.test(q))out.push('brand_model');
 }
 return [...new Set(out)].filter(x=>(modality==='voice'?VOICE_SCENARIOS:VISION_SCENARIOS).includes(x));
}

export function buildScenarioEvidence({labResults=[],modality,deviceKey,scenarios=[],minimumScenarioCases=12,maxAgeDays=30,now=Date.now()}={}){
 const active=[...new Set(scenarios??[])];
 if(!active.length)return {schemaVersion:1,scenarios:[],engineAdjustments:{},qualifiedPatterns:0,principle:PRINCIPLE};
 const buckets=new Map();
 for(const row of labResults??[]){
  if(row.modality!==modality||row.deviceKey!==deviceKey||!row.promotion?.promoted||!fresh(row,maxAgeDays,now))continue;
  for(const p of row.meta?.failurePatterns??[]){
   if(!active.includes(p.pattern)||Number(p.cases??0)<minimumScenarioCases)continue;
   const id=runtimeId(modality,row.engineId),key=`${id}|${p.pattern}`;
   buckets.set(key,{engineId:id,pattern:p.pattern,cases:Number(p.cases),avgQuality:Number(p.avgQuality??0),failureRate:Number(p.failureRate??1)});
  }
 }
 const engineAdjustments={};
 for(const scenario of active){
  const rows=[...buckets.values()].filter(x=>x.pattern===scenario);
  if(rows.length<2)continue;
  rows.sort((a,b)=>b.avgQuality-a.avgQuality||a.failureRate-b.failureRate);
  const best=rows[0],second=rows[1];
  if(best.avgQuality-second.avgQuality<.08&&second.failureRate-best.failureRate<.12)continue;
  engineAdjustments[best.engineId]=(engineAdjustments[best.engineId]??0)+.08;
  for(const weak of rows.filter(x=>x.failureRate>=.5))engineAdjustments[weak.engineId]=(engineAdjustments[weak.engineId]??0)-.08;
 }
 return {schemaVersion:1,scenarios:active,engineAdjustments,qualifiedPatterns:buckets.size,minimumScenarioCases,maxAgeDays,principle:PRINCIPLE};
}

export function scenarioEvidenceAdjustment({engineId,scenarioEvidence}={}){
 const delta=Number(scenarioEvidence?.engineAdjustments?.[engineId]??0);
 return {delta:Math.max(-.12,Math.min(.12,delta)),reason:delta>0?'SCENARIO_PROVEN_STRENGTH':delta<0?'SCENARIO_PROVEN_WEAKNESS':'NO_SCENARIO_EVIDENCE',scenarios:scenarioEvidence?.scenarios??[]};
}

const PRINCIPLE='Scenario evidence is a bounded ranking bias only. It requires promoted, fresh, same-device evidence and at least 12 cases for that specific scenario; it never bypasses runtime gates.';
function fresh(row,maxAgeDays,now){const t=Date.parse(row.updatedAt??'');return Number.isFinite(t)&&now-t<=maxAgeDays*86400000}
function runtimeId(modality,id=''){return modality==='vision'&&String(id).startsWith('visual:')?String(id).slice(7):String(id)}

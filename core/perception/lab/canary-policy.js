export function chooseCanaryEngine({labResults=[],modality,deviceKey,minimumAdvantage=.04}={}){
 const rows=labResults.filter(x=>x.modality===modality&&x.deviceKey===deviceKey&&x.promotion?.promoted);
 if(!rows.length)return {selected:null,reason:'NO_PROMOTED_ENGINE'};
 const ranked=rows.map(x=>({row:x,score:score(x.metrics)})).sort((a,b)=>b.score-a.score);
 if(ranked.length>1&&ranked[0].score-ranked[1].score<minimumAdvantage)
   return {selected:null,reason:'NO_CLEAR_WINNER',ranked:ranked.map(publicRow)};
 return {selected:ranked[0].row.engineId,reason:'CLEAR_LAB_WINNER',ranked:ranked.map(publicRow),mode:'canary_only'};
}
function score(m={}){
 const q=Number(m.avgQuality??0),s=Number(m.successRate??0);
 const p50=Number(m.p50LatencyMs??9999),p95=Number(m.p95LatencyMs??9999);
 return q*.5+s*.25+lat(p50,1500)*.15+lat(p95,4000)*.1;
}
function lat(ms,max){return Math.max(0,Math.min(1,1-ms/max))}
function publicRow(x){return {engineId:x.row.engineId,score:x.score}}

export function deterministicCorpusSplit(cases=[],{validationShare=.2,seed='seemind'}={}){
 const scored=cases.map(c=>({c,score:hash(`${seed}|${c.id}`)})).sort((a,b)=>a.score-b.score);
 const n=Math.max(cases.length>1?1:0,Math.round(cases.length*validationShare));
 return {validation:scored.slice(0,n).map(x=>x.c),development:scored.slice(n).map(x=>x.c)};
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

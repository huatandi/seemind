export function wordErrorRate(reference='',hypothesis=''){
 const r=tokens(reference),h=tokens(hypothesis);
 if(!r.length)return h.length?1:0;
 return levenshtein(r,h)/r.length;
}

export function semanticLabelScore(expected=[],predicted=[]){
 const e=new Set((expected??[]).map(normalize).filter(Boolean));
 const p=new Set((predicted??[]).map(normalize).filter(Boolean));
 if(!e.size)return p.size?0:1;
 let hit=0;
 for(const x of e)if([...p].some(y=>y===x||y.includes(x)||x.includes(y)))hit++;
 return hit/e.size;
}

export function intentAccuracy(expected,predicted){return normalize(expected)===normalize(predicted)?1:0}

export function latencyScore(ms,{excellent=700,maximum=2500}={}){
 const n=Number(ms);if(!Number.isFinite(n))return 0;
 if(n<=excellent)return 1;if(n>=maximum)return 0;
 return 1-(n-excellent)/(maximum-excellent);
}

export function compositePerceptionScore({quality=0,success=1,p50LatencyMs=null,p95LatencyMs=null,weights={}}={}){
 const w={quality:weights.quality??.5,success:weights.success??.2,p50:weights.p50??.2,p95:weights.p95??.1};
 return clamp(
   Number(quality)*w.quality+
   Number(success)*w.success+
   latencyScore(p50LatencyMs,{excellent:700,maximum:2500})*w.p50+
   latencyScore(p95LatencyMs,{excellent:1400,maximum:5000})*w.p95
 );
}
function tokens(s){return normalize(s).split(/\s+/).filter(Boolean)}
function normalize(s){return String(s??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function levenshtein(a,b){
 const prev=Array.from({length:b.length+1},(_,i)=>i),cur=Array(b.length+1).fill(0);
 for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j]}
 return prev[b.length];
}
function clamp(v){return Math.max(0,Math.min(1,Number(v)||0))}

export function scoreMultimodalGrounding({expected={},actual={}}={}){
 const checks=[
   eq('intent',expected.intent,actual.intent,.25),
   eq('reference',expected.reference,actual.reference,.30),
   eq('target',expected.target,actual.target,.30),
   eq('state_or_problem',expected.stateOrProblem,actual.stateOrProblem,.15),
 ].filter(x=>x.applicable);
 const score=checks.length?checks.reduce((s,x)=>s+x.score*x.weight,0)/checks.reduce((s,x)=>s+x.weight,0):null;
 return {schemaVersion:1,score,checks};
}
function eq(id,e,a,weight){
 const applicable=e!=null;
 return {id,weight,applicable,expected:e??null,actual:a??null,score:applicable&&norm(e)===norm(a)?1:0};
}
function norm(x){return String(x??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()}

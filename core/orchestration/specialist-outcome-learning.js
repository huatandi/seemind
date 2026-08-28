/**
 * Learns provider × capability × task performance from attributable outcomes.
 * API completion is not treated as task success. Strong facts require verification.
 */
export class SpecialistOutcomeStore{
  constructor(seed=[]){this.rows=new Map();for(const x of seed)this.rows.set(keyOf(x.providerId,x.capability,x.taskKind),normalize(x))}
  record({providerId,capabilities=[],taskKind='*',signal,weight=null,latencyMs=null,cost=null,meta={}}={}){
    if(!providerId||!signal)return [];
    const caps=[...new Set(capabilities.length?capabilities:['*'])],out=[];
    for(const capability of caps){
      const key=keyOf(providerId,capability,taskKind),prev=this.rows.get(key)??normalize({providerId,capability,taskKind});
      const impact=signalImpact(signal,weight),attempts=prev.attempts+(impact.attempt?1:0);
      const evidenceWeight=prev.evidenceWeight+impact.weight;
      const evidenceScore=evidenceWeight?clamp01((prev.evidenceScore*prev.evidenceWeight+impact.score*impact.weight)/evidenceWeight):prev.evidenceScore;
      const next=normalize({...prev,providerId,capability,taskKind,attempts,evidenceWeight,evidenceScore,
        verifiedSuccesses:prev.verifiedSuccesses+(signal==='verified_success'?1:0),
        corrections:prev.corrections+(signal==='user_corrected'?1:0),
        contradictions:prev.contradictions+(signal==='authoritative_contradiction'?1:0),
        unresolved:prev.unresolved+(signal==='residual_unresolved'?1:0),
        technicalFailures:prev.technicalFailures+(signal==='technical_failure'?1:0),
        avgLatencyMs:rolling(prev.avgLatencyMs,prev.attempts,latencyMs),avgCost:rolling(prev.avgCost,prev.attempts,cost),
        lastSignal:signal,lastMeta:meta,updatedAt:new Date().toISOString()});
      this.rows.set(key,next);out.push(next);
    }return out;
  }
  get(providerId,taskKind='*',capabilities=[]){
    const caps=capabilities.length?capabilities:['*'];
    const rows=caps.map(c=>this.rows.get(keyOf(providerId,c,taskKind))??this.rows.get(keyOf(providerId,c,'*'))).filter(Boolean);
    if(!rows.length)return null;
    const evidenceWeight=rows.reduce((s,x)=>s+Number(x.evidenceWeight??0),0);
    const mean=rows.reduce((s,x)=>s+x.evidenceScore,0)/rows.length;
    // Conservative shrinkage prevents 1/1 newcomers from masquerading as proven 100% specialists.
    const priorWeight=4, confidenceAdjustedSuccess=(mean*evidenceWeight+.5*priorWeight)/(evidenceWeight+priorWeight);
    return {attempts:Math.max(...rows.map(x=>x.attempts)),historicalSuccess:confidenceAdjustedSuccess,rawHistoricalSuccess:mean,evidenceWeight,
      confidence:Math.min(1,evidenceWeight/12),avgLatencyMs:average(rows.map(x=>x.avgLatencyMs)),avgCost:average(rows.map(x=>x.avgCost)),rows};
  }
  snapshot(){return [...this.rows.values()].map(x=>({...x}))}
}
export function classifySpecialistOutcome({technicalOk=false,verified=false,userCorrected=false,authoritativeContradiction=false,residualResolved=null}={}){
  if(!technicalOk)return 'technical_failure';
  if(authoritativeContradiction)return 'authoritative_contradiction';
  if(userCorrected)return 'user_corrected';
  if(verified)return 'verified_success';
  if(residualResolved===false)return 'residual_unresolved';
  if(residualResolved===true)return 'provisional_resolution';
  return 'technical_success_only';
}
function signalImpact(signal,weight){
  const map={
    verified_success:{score:1,weight:3,attempt:true},
    provisional_resolution:{score:.72,weight:1,attempt:true},
    technical_success_only:{score:.5,weight:0,attempt:true},
    residual_unresolved:{score:.2,weight:1.5,attempt:true},
    user_corrected:{score:0,weight:2.5,attempt:true},
    authoritative_contradiction:{score:0,weight:3,attempt:true},
    technical_failure:{score:.15,weight:1,attempt:true},
  };const x=map[signal]??{score:.5,weight:0,attempt:false};return {...x,weight:weight==null?x.weight:Math.max(0,Number(weight)||0)}
}
function normalize(x={}){return {providerId:String(x.providerId??''),capability:String(x.capability??'*'),taskKind:String(x.taskKind??'*'),attempts:Number(x.attempts??0),evidenceWeight:Number(x.evidenceWeight??0),evidenceScore:clamp01(x.evidenceScore??.5),verifiedSuccesses:Number(x.verifiedSuccesses??0),corrections:Number(x.corrections??0),contradictions:Number(x.contradictions??0),unresolved:Number(x.unresolved??0),technicalFailures:Number(x.technicalFailures??0),avgLatencyMs:numberOrNull(x.avgLatencyMs),avgCost:numberOrNull(x.avgCost),lastSignal:x.lastSignal??null,lastMeta:x.lastMeta??null,updatedAt:x.updatedAt??null}}
function keyOf(p,c,t){return `${p}::${c||'*'}::${t||'*'}`}
function rolling(avg,count,v){if(v==null||!Number.isFinite(Number(v)))return avg??null;const n=Number(v);return avg==null?n:(Number(avg)*count+n)/(count+1)}
function average(xs){const a=xs.filter(x=>x!=null&&Number.isFinite(Number(x))).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
function numberOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp01(v){return Math.max(0,Math.min(1,Number(v)||0))}

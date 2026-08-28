import {runEngineCompetition} from './benchmark-competition.js';

export function languageFamily(language='auto'){
 const base=String(language??'auto').toLowerCase().split(/[-_]/)[0];
 if(['zh','cmn','yue'].includes(base))return 'zh';
 if(base==='es')return 'es';
 if(base==='en')return 'en';
 return base||'auto';
}

export function buildVoiceLeagueCohorts(cases=[]){
 const map=new Map();
 for(const c of cases){
  const key=languageFamily(c.language);
  const arr=map.get(key)??[];arr.push(c);map.set(key,arr);
 }
 return [...map.entries()].map(([language,cases])=>({language,cases}));
}

export function eligibleVoiceEngines(engines=[],language='auto'){
 return engines.filter(engine=>{
  if(typeof engine.supportsLanguage==='function')return engine.supportsLanguage(language);
  const langs=engine.profile?.languages??['auto'];
  const f=languageFamily(language);
  return langs.includes('auto')||langs.includes('multilingual')||langs.includes(f);
 });
}

export function buildVoiceLeagueMatrix({rounds=[]}={}){
 const matrix={};
 for(const round of rounds){
  if(round.status!=='completed')continue;
  for(const d of round.competition?.decisions??[]){
   const m=d.metrics??{};
   matrix[round.language]??={};
   matrix[round.language][d.engineId]={
    cases:Number(m.cases??0),quality:Number(m.avgQuality??0),successRate:Number(m.successRate??0),
    p50LatencyMs:Number(m.p50LatencyMs??0),p95LatencyMs:Number(m.p95LatencyMs??0),
    promoted:Boolean(d.promotion?.promoted),verdict:d.engineId===round.competition.baselineEngineId?'BASELINE':d.comparison?.verdict??'UNKNOWN',
   };
  }
 }
 return matrix;
}

export function recommendVoiceEngineForCohort(engineRows={}){
 const rows=Object.entries(engineRows).filter(([,m])=>m.cases>0&&m.successRate>0);
 if(!rows.length)return null;
 rows.sort((a,b)=>{
  const qa=b[1].quality-a[1].quality;if(Math.abs(qa)>.02)return qa;
  const sa=b[1].successRate-a[1].successRate;if(Math.abs(sa)>.01)return sa;
  return a[1].p50LatencyMs-b[1].p50LatencyMs;
 });
 const [engineId,metrics]=rows[0];
 return {engineId,metrics,reason:'quality_first_then_success_then_latency',evidenceOnly:true};
}

export async function runVoiceLeague({engines=[],cases=[],deviceProfile={},corpusId='pilot',resolveAsset,scoreCase,onProgress}={}){
 const cohorts=buildVoiceLeagueCohorts(cases),rounds=[];
 for(const cohort of cohorts){
  const eligible=eligibleVoiceEngines(engines,cohort.language);
  if(!eligible.length){
   rounds.push({language:cohort.language,status:'skipped',reason:'NO_ELIGIBLE_ENGINE',cases:cohort.cases.length});
   continue;
  }
  const competition=await runEngineCompetition({
   engines:eligible,modality:'voice',cases:cohort.cases,deviceProfile,
   corpusId:`${corpusId}:${cohort.language}`,resolveAsset,scoreCase,
   baselineEngineId:eligible[0].id,
   onProgress:e=>onProgress?.({language:cohort.language,...e}),
  });
  rounds.push({language:cohort.language,status:'completed',cases:cohort.cases.length,competition});
 }
 return {schemaVersion:1,rounds,principle:'Compare ASR engines only on language cohorts they actually support.'};
}

export function composeEvidenceWeight({
  autotune=0,
  lab=0,
  scenario=0,
  outcome=0,
  modality='unknown',
  positiveBudget=.20,
  negativeBudget=.28,
  benchmarkFamilyPositiveBudget=.16,
}={}){
  const raw={autotune:num(autotune),lab:num(lab),scenario:num(scenario),outcome:num(outcome)};
  // Autotune, Lab promotion and Scenario evidence are correlated: they are all
  // ultimately derived from benchmark observations. They share one budget so
  // the same evidence cannot be rewarded three times.
  const benchmarkPositive=positive(raw.autotune)+positive(raw.lab)+positive(raw.scenario);
  const benchmarkScale=benchmarkPositive>benchmarkFamilyPositiveBudget?benchmarkFamilyPositiveBudget/benchmarkPositive:1;
  const applied={
    autotune:raw.autotune>0?raw.autotune*benchmarkScale:raw.autotune,
    lab:raw.lab>0?raw.lab*benchmarkScale:raw.lab,
    scenario:raw.scenario>0?raw.scenario*benchmarkScale:raw.scenario,
    outcome:raw.outcome,
  };
  const positiveTotal=Object.values(applied).reduce((s,v)=>s+positive(v),0);
  if(positiveTotal>positiveBudget){
    const scale=positiveBudget/positiveTotal;
    for(const k of Object.keys(applied))if(applied[k]>0)applied[k]*=scale;
  }
  const negativeTotal=Object.values(applied).reduce((s,v)=>s+negative(v),0);
  if(negativeTotal>negativeBudget){
    const scale=negativeBudget/negativeTotal;
    for(const k of Object.keys(applied))if(applied[k]<0)applied[k]*=scale;
  }
  const total=Object.values(applied).reduce((s,v)=>s+v,0);
  return {
    schemaVersion:1,modality,raw,applied,
    delta:clamp(total,-negativeBudget,positiveBudget),
    budgets:{positiveBudget,negativeBudget,benchmarkFamilyPositiveBudget},
    capped:Math.abs(total-(raw.autotune+raw.lab+raw.scenario+raw.outcome))>.000001,
    principle:'Correlated benchmark-derived signals share one evidence budget. Evidence may refine a qualified candidate ranking but cannot overwhelm core capability, health, reliability, latency or device-fit scoring.',
  };
}

function num(v){v=Number(v);return Number.isFinite(v)?v:0}
function positive(v){return v>0?v:0}
function negative(v){return v<0?-v:0}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

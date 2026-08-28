export async function runGoldenDataset({dataset,runner,candidateId='baseline',metadata={}}={}){
  if(!dataset?.list)throw new Error('GOLDEN_DATASET_REQUIRED');
  if(typeof runner!=='function')throw new Error('GOLDEN_RUNNER_REQUIRED');
  const results=[];
  for(const golden of dataset.list()){
    const started=Date.now();
    try{
      const actual=await runner(golden);
      const comparison=compareExpected(golden.expected,actual);
      results.push({caseId:golden.id,task:golden.task,critical:golden.critical,weight:golden.weight,passed:comparison.passed,score:comparison.score,failures:comparison.failures,durationMs:Date.now()-started});
    }catch(error){
      results.push({caseId:golden.id,task:golden.task,critical:golden.critical,weight:golden.weight,passed:false,score:0,failures:[`RUNNER_ERROR:${String(error?.message??error)}`],durationMs:Date.now()-started});
    }
  }
  return buildReport(results,{candidateId,metadata});
}

export function compareGoldenReports(baseline,candidate){
  const byId=new Map((baseline?.results??[]).map(x=>[x.caseId,x]));
  const regressions=[],improvements=[];
  for(const c of candidate?.results??[]){
    const b=byId.get(c.caseId);if(!b)continue;
    if(c.score<b.score||(!c.passed&&b.passed))regressions.push({caseId:c.caseId,baselineScore:b.score,candidateScore:c.score,critical:Boolean(c.critical),failures:c.failures});
    if(c.score>b.score||(c.passed&&!b.passed))improvements.push({caseId:c.caseId,baselineScore:b.score,candidateScore:c.score});
  }
  const criticalRegressions=regressions.filter(x=>x.critical).map(x=>x.caseId);
  return {
    baselineScore:Number(baseline?.score??0),candidateScore:Number(candidate?.score??0),
    delta:Number(candidate?.score??0)-Number(baseline?.score??0),
    regressions,improvements,criticalRegressions,
    passed:criticalRegressions.length===0&&regressions.length===0,
    total:Number(candidate?.caseCount??0),failed:regressions.length,
  };
}

export function compareExpected(expected,actual){
  const failures=[];let checks=0,passed=0;
  walk(expected,actual,'$',failures,()=>checks++,()=>passed++);
  return {passed:failures.length===0,score:checks?Math.round((passed/checks)*100):100,failures};
}
function walk(e,a,path,failures,onCheck,onPass){
  if(e&&typeof e==='object'&&!Array.isArray(e)){
    if('$oneOf'in e){onCheck();if(e.$oneOf.some(x=>deepEqual(x,a)))onPass();else failures.push(`${path}: expected oneOf ${JSON.stringify(e.$oneOf)}, got ${JSON.stringify(a)}`);return}
    if('$includes'in e){onCheck();if(Array.isArray(a)&&e.$includes.every(x=>a.some(y=>deepEqual(x,y))))onPass();else failures.push(`${path}: missing expected members`);return}
    for(const [k,v] of Object.entries(e)){walk(v,a?.[k],`${path}.${k}`,failures,onCheck,onPass)}return;
  }
  onCheck();if(deepEqual(e,a))onPass();else failures.push(`${path}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
}
function deepEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function buildReport(results,{candidateId,metadata}){
  const totalWeight=results.reduce((s,x)=>s+x.weight,0)||1;
  const score=Math.round(results.reduce((s,x)=>s+x.score*x.weight,0)/totalWeight);
  const failed=results.filter(x=>!x.passed),criticalFailures=failed.filter(x=>x.critical).map(x=>x.caseId);
  return {schemaVersion:1,reportId:`golden-${candidateId}-${Date.now()}`,candidateId,createdAt:new Date().toISOString(),caseCount:results.length,passedCount:results.length-failed.length,failedCount:failed.length,score,criticalFailures,byTask:summarize(results),results,metadata};
}
function summarize(results){const out={};for(const r of results){const x=out[r.task]??={cases:0,passed:0,scoreTotal:0};x.cases++;x.passed+=Number(r.passed);x.scoreTotal+=r.score}for(const x of Object.values(out))x.score=Math.round(x.scoreTotal/x.cases);return out}

import {withDeadline} from '../performance/timeout.js';
import {compareExpected} from './evaluation-lab.js';

export class OcrBenchmarkDataset{
  constructor(cases=[]){this.cases=[];for(const c of cases)this.add(c)}
  add(input={}){
    if(!input.id)throw new Error('OCR_BENCHMARK_CASE_ID_REQUIRED');
    if(this.cases.some(x=>x.id===String(input.id)))throw new Error(`DUPLICATE_OCR_BENCHMARK_CASE:${input.id}`);
    const c={
      schemaVersion:1,
      id:String(input.id),
      difficulty:String(input.difficulty??'unknown'),
      receiptType:String(input.receiptType??'unknown'),
      tags:[...(input.tags??[])].map(String),
      image:input.image??null,
      expected:clone(input.expected??{}),
      criticalFields:[...(input.criticalFields??['total','date'])].map(String),
      metadata:clone(input.metadata??{}),
    };
    this.cases.push(Object.freeze(c));return c;
  }
  list(){return [...this.cases]}
  summary(){return {
    caseCount:this.cases.length,
    byDifficulty:countBy(this.cases,'difficulty'),
    byReceiptType:countBy(this.cases,'receiptType'),
  }}
}

export async function runOcrBenchmark({dataset,strategies,caseLoader=null,caseLoaderTimeoutMs=10000,strategyTimeoutMs=30000}={}){
  if(!dataset?.list)throw new Error('OCR_BENCHMARK_DATASET_REQUIRED');
  if(!strategies||typeof strategies!=='object'||!Object.keys(strategies).length)throw new Error('OCR_BENCHMARK_STRATEGIES_REQUIRED');
  const results=[];
  for(const golden of dataset.list()){
    let input=golden.image,loaderError=null;
    if(caseLoader){
      try{input=await withDeadline(caseLoader(golden),caseLoaderTimeoutMs,'OCR_BENCHMARK_CASE_LOADER_TIMEOUT')}catch(error){loaderError=error}
    }
    for(const [strategyId,runner] of Object.entries(strategies)){
      if(loaderError){
        results.push({caseId:golden.id,strategyId,difficulty:golden.difficulty,receiptType:golden.receiptType,elapsedMs:0,failed:true,fieldAccuracy:0,criticalAccuracy:0,totalCorrect:false,dateCorrect:false,failureCode:safeCode(loaderError),comparisonFailures:[`CASE_LOADER_ERROR:${safeCode(loaderError)}`]});
        continue;
      }
      const started=nowMs();
      try{
        const actual=await withDeadline(runner({golden,input}),strategyTimeoutMs,'OCR_BENCHMARK_STRATEGY_TIMEOUT');
        const elapsedMs=Math.max(0,nowMs()-started);
        const metrics=scoreOcrBenchmarkCase(golden,actual);
        results.push({caseId:golden.id,strategyId,difficulty:golden.difficulty,receiptType:golden.receiptType,elapsedMs,failed:false,...metrics});
      }catch(error){
        results.push({
          caseId:golden.id,strategyId,difficulty:golden.difficulty,receiptType:golden.receiptType,
          elapsedMs:Math.max(0,nowMs()-started),failed:true,fieldAccuracy:0,criticalAccuracy:0,totalCorrect:false,dateCorrect:false,
          failureCode:safeCode(error),comparisonFailures:[`RUNNER_ERROR:${safeCode(error)}`],
        });
      }
    }
  }
  return buildBenchmarkReport(results,Object.keys(strategies));
}

export function scoreOcrBenchmarkCase(golden,actual={}){
  const expected=golden.expected??{};
  const receipt=actual.receipt??actual;
  const fields=Object.keys(expected).filter(k=>expected[k]&&typeof expected[k]==='object'&&'value'in expected[k]);
  let correct=0;
  for(const f of fields)if(equal(expected[f]?.value,receipt?.[f]?.value))correct++;
  const critical=golden.criticalFields??[];
  let criticalCorrect=0,criticalChecks=0;
  for(const f of critical){
    if(!expected[f]||!('value'in expected[f]))continue;
    criticalChecks++;
    if(equal(expected[f]?.value,receipt?.[f]?.value))criticalCorrect++;
  }
  const comparison=compareExpected(expected,receipt);
  return {
    fieldAccuracy:fields.length?round(correct/fields.length):1,
    criticalAccuracy:criticalChecks?round(criticalCorrect/criticalChecks):1,
    totalCorrect:expected.total&&'value'in expected.total?equal(expected.total.value,receipt?.total?.value):null,
    dateCorrect:expected.date&&'value'in expected.date?equal(expected.date.value,receipt?.date?.value):null,
    exactCasePass:comparison.passed,
    comparisonFailures:comparison.failures,
    evidenceScore:Number(actual?.scoring?.score??actual?.evidenceScore??0)||0,
    fallbackUsed:Boolean(actual?.fallbackUsed),
    recognitions:Number(actual?.recognitions??1)||1,
    stageTimings:normalizeStageTimings(actual?.stageTimings??actual?.timings),
    firstUsefulMs:finiteNonNegative(actual?.firstUsefulMs),
    coldStart:inferColdStart(actual),
    runtimeDiagnostics:normalizeRuntimeDiagnostics(actual?.diagnostics),
  };
}

export function compareOcrStrategies(report,{minimumCases=5,maxRegressionRate=.02}={}){
  const leaders={};
  const groups=new Set(report.results.map(x=>`${x.difficulty}|${x.receiptType}`));
  for(const key of groups){
    const [difficulty,receiptType]=key.split('|');
    const rows=report.results.filter(x=>x.difficulty===difficulty&&x.receiptType===receiptType);
    const byStrategy=aggregate(rows);
    const eligible=Object.entries(byStrategy).filter(([,m])=>m.cases>=minimumCases);
    if(!eligible.length)continue;
    eligible.sort((a,b)=>promotionScore(b[1])-promotionScore(a[1]));
    leaders[key]={difficulty,receiptType,strategyId:eligible[0][0],metrics:eligible[0][1]};
  }
  const overall=aggregate(report.results);
  const ranking=Object.entries(overall).sort((a,b)=>promotionScore(b[1])-promotionScore(a[1]));
  return {
    schemaVersion:1,
    leaders,
    overallRanking:ranking.map(([strategyId,metrics])=>({strategyId,metrics,promotionScore:round(promotionScore(metrics),4)})),
    recommendation:buildRecommendation(ranking,{minimumCases,maxRegressionRate}),
  };
}

function buildBenchmarkReport(results,strategies){
  const overall=aggregate(results);
  return {
    schemaVersion:1,
    createdAt:new Date().toISOString(),
    caseCount:new Set(results.map(x=>x.caseId)).size,
    strategies,
    results,
    aggregate:overall,
  };
}

function aggregate(rows){
  const out={};
  for(const r of rows){
    const x=out[r.strategyId]??={cases:0,failures:0,fieldAccuracyTotal:0,criticalAccuracyTotal:0,totalChecks:0,totalCorrect:0,dateChecks:0,dateCorrect:0,elapsedTotal:0,latencies:[],fallbacks:0,recognitions:0,cacheHits:0,workerCreates:0,runtimeDiagnosticSamples:0,failureCodes:{}};
    x.cases++;x.failures+=Number(r.failed);x.coldLatencies=x.coldLatencies??[];x.warmLatencies=x.warmLatencies??[];(r.coldStart?x.coldLatencies:x.warmLatencies).push(Number(r.elapsedMs??0));x.firstUsefulSamples=x.firstUsefulSamples??[];if(r.firstUsefulMs!=null)x.firstUsefulSamples.push(r.firstUsefulMs);x.stageTimingSamples=x.stageTimingSamples??{};for(const [stage,ms] of Object.entries(r.stageTimings??{}))(x.stageTimingSamples[stage]??=[]).push(ms);x.fieldAccuracyTotal+=r.fieldAccuracy??0;x.criticalAccuracyTotal+=r.criticalAccuracy??0;x.elapsedTotal+=r.elapsedMs??0;x.latencies.push(Number(r.elapsedMs??0));x.fallbacks+=Number(r.fallbackUsed);x.recognitions+=Number(r.recognitions??0);if(r.runtimeDiagnostics){x.runtimeDiagnosticSamples++;x.cacheHits+=Number(r.runtimeDiagnostics.workerCacheHit);x.workerCreates+=Number(r.runtimeDiagnostics.workerCreated)}if(r.failed){const code=String(r.failureCode??'UNKNOWN');x.failureCodes[code]=(x.failureCodes[code]??0)+1}
    if(r.totalCorrect!=null){x.totalChecks++;x.totalCorrect+=Number(r.totalCorrect)}
    if(r.dateCorrect!=null){x.dateChecks++;x.dateCorrect+=Number(r.dateCorrect)}
  }
  for(const x of Object.values(out)){
    x.fieldAccuracy=round(x.fieldAccuracyTotal/x.cases);
    x.criticalAccuracy=round(x.criticalAccuracyTotal/x.cases);
    x.totalAccuracy=x.totalChecks?round(x.totalCorrect/x.totalChecks):null;
    x.dateAccuracy=x.dateChecks?round(x.dateCorrect/x.dateChecks):null;
    x.failureRate=round(x.failures/x.cases);
    x.avgLatencyMs=Math.round(x.elapsedTotal/x.cases);
    x.p50LatencyMs=Math.round(percentile(x.latencies,.50));
    x.p95LatencyMs=Math.round(percentile(x.latencies,.95));
    x.fallbackRate=round(x.fallbacks/x.cases);
    x.avgRecognitions=round(x.recognitions/x.cases);
    x.coldSamples=x.coldLatencies.length;
    x.warmSamples=x.warmLatencies.length;
    x.coldStartAvgLatencyMs=avgRounded(x.coldLatencies);
    x.coldStartP50LatencyMs=pctRoundedOrNull(x.coldLatencies,.50);
    x.coldStartP95LatencyMs=pctRoundedOrNull(x.coldLatencies,.95);
    x.warmAvgLatencyMs=avgRounded(x.warmLatencies);
    x.warmP50LatencyMs=pctRoundedOrNull(x.warmLatencies,.50);
    x.warmP95LatencyMs=pctRoundedOrNull(x.warmLatencies,.95);
    x.coldWarmDeltaMs=x.coldStartAvgLatencyMs!=null&&x.warmAvgLatencyMs!=null?x.coldStartAvgLatencyMs-x.warmAvgLatencyMs:null;
    x.warmSpeedupRatio=x.coldStartAvgLatencyMs!=null&&x.warmAvgLatencyMs>0?round(x.coldStartAvgLatencyMs/x.warmAvgLatencyMs,3):null;
    x.workerCacheHitRate=x.runtimeDiagnosticSamples?round(x.cacheHits/x.runtimeDiagnosticSamples):null;
    x.workerCreationRate=x.runtimeDiagnosticSamples?round(x.workerCreates/x.runtimeDiagnosticSamples):null;
    x.failureCodes=Object.fromEntries(Object.entries(x.failureCodes).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));
    x.timeoutRate=round(Object.entries(x.failureCodes).filter(([code])=>code.includes('TIMEOUT')).reduce((sum,[,count])=>sum+count,0)/x.cases);

    x.firstUsefulSamplesCount=x.firstUsefulSamples.length;
    x.p50FirstUsefulMs=x.firstUsefulSamples.length?Math.round(percentile(x.firstUsefulSamples,.50)):null;
    x.p95FirstUsefulMs=x.firstUsefulSamples.length?Math.round(percentile(x.firstUsefulSamples,.95)):null;
    x.stageTimings=Object.fromEntries(Object.entries(x.stageTimingSamples).map(([stage,values])=>[stage,{samples:values.length,p50Ms:Math.round(percentile(values,.50)),p95Ms:Math.round(percentile(values,.95)),avgMs:Math.round(values.reduce((a,b)=>a+b,0)/values.length),maxMs:Math.round(Math.max(...values))}]));
    x.latencyHead=Object.entries(x.stageTimings).sort((a,b)=>b[1].p95Ms-a[1].p95Ms||a[0].localeCompare(b[0]))[0]?.[0]??null;
    const stageP95Total=Object.values(x.stageTimings).reduce((sum,stage)=>sum+stage.p95Ms,0);
    x.latencyHeadP95Share=x.latencyHead&&stageP95Total>0?round(x.stageTimings[x.latencyHead].p95Ms/stageP95Total,3):null;
    delete x.coldLatencies;delete x.warmLatencies;delete x.firstUsefulSamples;delete x.stageTimingSamples;delete x.fieldAccuracyTotal;delete x.criticalAccuracyTotal;delete x.elapsedTotal;delete x.latencies;delete x.totalChecks;delete x.totalCorrect;delete x.dateChecks;delete x.dateCorrect;delete x.fallbacks;delete x.recognitions;delete x.cacheHits;delete x.workerCreates;delete x.runtimeDiagnosticSamples;
  }
  return out;
}

function promotionScore(m){
  const avgLatencyScore=1-Math.min(1,(m.avgLatencyMs??0)/10000);
  const tailLatencyScore=1-Math.min(1,(m.p95LatencyMs??m.avgLatencyMs??0)/10000);
  return (m.criticalAccuracy??0)*.38+(m.fieldAccuracy??0)*.28+(m.totalAccuracy??m.criticalAccuracy??0)*.16+(1-(m.failureRate??1))*.12+avgLatencyScore*.03+tailLatencyScore*.03;
}
function buildRecommendation(ranking,{minimumCases}){
  if(!ranking.length)return {status:'insufficient_data',reason:'NO_RESULTS'};
  const [winnerId,winner]=ranking[0];
  if((winner.cases??0)<minimumCases)return {status:'insufficient_data',reason:'MINIMUM_CASES_NOT_MET',minimumCases,observed:winner.cases??0};
  return {
    status:'candidate',
    strategyId:winnerId,
    reason:'BENCHMARK_LEADER',
    metrics:winner,
    requiresRegression:true,
    requiresExplicitApproval:true,
  };
}
function inferColdStart(actual){
  if(actual?.coldStart===true)return true;
  if(actual?.coldStart===false)return false;
  const d=actual?.diagnostics;
  if(d&&typeof d==='object'){
    if(d.workerCreated===true)return true;
    if(d.workerCacheHit===true)return false;
  }
  return false;
}
function normalizeRuntimeDiagnostics(d){
  if(!d||typeof d!=='object')return null;
  if(typeof d.workerCacheHit!=='boolean'&&typeof d.workerCreated!=='boolean')return null;
  return {workerCacheHit:d.workerCacheHit===true,workerCreated:d.workerCreated===true};
}
function avgRounded(values){return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null}
function pctRoundedOrNull(values,p){return values.length?Math.round(percentile(values,p)):null}
function finiteNonNegative(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function normalizeStageTimings(value){const out={};if(!value||typeof value!=='object')return out;for(const [k,v] of Object.entries(value)){const n=Number(v);if(Number.isFinite(n)&&n>=0)out[String(k)]=n}return out}
function percentile(values,p){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);const i=Math.min(a.length-1,Math.max(0,Math.ceil(a.length*p)-1));return a[i]}
function nowMs(){return globalThis.performance?.now?.()??Date.now()}
function countBy(arr,key){const out={};for(const x of arr)out[x[key]]=(out[x[key]]??0)+1;return out}
function safeCode(error){const s=String(error?.code??error?.message??'OCR_BENCHMARK_FAILURE');return /^[A-Z0-9_:-]{3,100}$/.test(s)?s:'OCR_BENCHMARK_FAILURE'}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function round(n,d=4){const p=10**d;return Math.round(Number(n)*p)/p}

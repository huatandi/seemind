export function routeOcrEngines({engines=[],quality={},performanceStore=null,deviceClass='balanced'}={}){
  if(!Array.isArray(engines)||!engines.length)throw new Error('OCR_ENGINES_REQUIRED');
  const difficulty=estimateReceiptDifficulty(quality);
  const ranked=engines.map(engine=>{
    const perf=performanceStore?.publicStats?.(engine.id)??{};
    const score=scoreEngine(engine,perf,{difficulty,deviceClass});
    return {engine,engineId:engine.id,score,reasons:score.reasons,performance:perf};
  }).sort((a,b)=>b.score.total-a.score.total||((b.engine.priority??0)-(a.engine.priority??0)));

  const primary=ranked[0];
  const primaryHealthy=!isDegraded(primary.performance);
  const easy=difficulty.level==='easy';
  const hard=difficulty.level==='hard';
  let maxEngines=Math.min(2,ranked.length),maxPassesPerEngine=easy?1:2,maxTotalRecognitions=easy?2:3;
  let strategy=ranked.length>1?'primary-with-fallback':'single';
  let earlyStopScore=easy?78:86;

  if(!primaryHealthy&&ranked.length>1){
    maxEngines=2;maxPassesPerEngine=1;maxTotalRecognitions=2;strategy='fallback-ready';earlyStopScore=84;
  }else if(hard&&ranked.length>1){
    maxEngines=2;maxPassesPerEngine=deviceClass==='low_power'?1:2;maxTotalRecognitions=deviceClass==='low_power'?2:4;strategy='dual-competition';earlyStopScore=null;
  }else if(difficulty.level==='medium'){
    maxEngines=Math.min(2,ranked.length);maxPassesPerEngine=deviceClass==='low_power'?1:2;maxTotalRecognitions=deviceClass==='low_power'?2:3;strategy='primary-with-fallback';earlyStopScore=86;
  }

  return {
    schemaVersion:1,
    strategy,
    difficulty,
    engines:ranked.slice(0,maxEngines).map(x=>x.engine),
    ranking:ranked.map(x=>({engineId:x.engineId,score:x.score.total,reasons:x.reasons,performance:x.performance})),
    budget:{maxEngines,maxPassesPerEngine,maxTotalRecognitions,earlyStopScore},
  };
}

export function estimateReceiptDifficulty(quality={}){
  const flags=new Set(quality.flags??[]);
  let score=0;
  if(flags.has('underexposed')||flags.has('overexposed'))score+=2;
  if(flags.has('low_contrast'))score+=2;
  if(flags.has('blurry_or_low_detail'))score+=2;
  if(flags.has('dark_clipping')||flags.has('highlight_clipping'))score+=1;
  if(Number(quality.score)<.45)score+=2;
  if(Number(quality.score)>=.75&&flags.size===0)score-=1;
  const level=score>=4?'hard':score>=2?'medium':'easy';
  return {level,score,reasons:[...flags]};
}

function scoreEngine(engine,perf,{difficulty,deviceClass}){
  const priority=Math.max(0,Math.min(100,Number(engine.priority)||50))/100;
  const successRate=perf.routingSuccessRate??(perf.successRate==null?.75:perf.successRate);
  const evidence=perf.avgEvidenceScore==null?70:Math.max(0,Math.min(100,perf.avgEvidenceScore))/100;
  const latency=latencyScore(perf.avgLatencyMs,deviceClass);
  const failurePenalty=Math.min(.5,(perf.consecutiveFailures??0)*.18);
  const capabilityBonus=difficulty.level==='hard'?(engine.capabilities?.bboxes?.05:0)+(engine.capabilities?.orientation?.05:0):0;
  const total=round(Math.max(0,
    priority*.20+successRate*.30+evidence*.28+latency*.22+capabilityBonus-failurePenalty
  ));
  return {
    total,
    priority:round(priority),successRate:round(successRate),evidence:round(evidence),latency:round(latency),
    failurePenalty:round(failurePenalty),capabilityBonus:round(capabilityBonus),
    reasons:[
      `priority:${round(priority)}`,`success:${round(successRate)}`,`evidence:${round(evidence)}`,
      `latency:${round(latency)}`,`failures:${perf.consecutiveFailures??0}`,`difficulty:${difficulty.level}`
    ]
  };
}
function latencyScore(ms,deviceClass){
  if(!Number.isFinite(Number(ms)))return .65;
  const target=deviceClass==='low_power'?1200:deviceClass==='performance'?3500:2200;
  return Math.max(.05,Math.min(1,target/Math.max(1,Number(ms))));
}
function isDegraded(perf){return (perf.consecutiveFailures??0)>=2||(perf.successRate!=null&&perf.attempts>=4&&perf.successRate<.5)}
function round(n){return Math.round(n*1000)/1000}

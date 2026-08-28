import test from 'node:test';
import assert from 'node:assert/strict';
import {BenchmarkAssetVault} from '../core/perception/lab/benchmark-asset-vault.js';
import {scoreVisionBenchmarkCase,extractVisualLabels} from '../core/perception/lab/vision-benchmark-scorer.js';
import {scoreVoiceBenchmarkCase} from '../core/perception/lab/voice-benchmark-scorer.js';
import {runEngineCompetition} from '../core/perception/lab/benchmark-competition.js';

test('asset vault preserves real blob bytes in memory fallback',async()=>{
 const vault=new BenchmarkAssetVault();
 const blob=new Blob(['real-image-bytes'],{type:'image/jpeg'});Object.defineProperty(blob,'name',{value:'photo.jpg'});
 const saved=await vault.put(blob,{kind:'vision'});
 assert.match(saved.assetRef,/^vault:/);
 const resolved=await vault.resolve(saved.assetRef);
 assert.equal(await resolved.text(),'real-image-bytes');
 const stats=await vault.stats();assert.equal(stats.count,1);
});

test('vision scorer extracts labels from observation and provider result shapes',()=>{
 const result={observations:[{identity:[{label:'cat'}],scene:[{label:'living_room'}]}]};
 assert.deepEqual(extractVisualLabels(result),['cat','living_room']);
 const scored=scoreVisionBenchmarkCase({case:{expected:{labels:['cat']}},result});
 assert.equal(scored.quality,1);
});

test('voice scorer measures exact transcript as perfect quality',()=>{
 const r=scoreVoiceBenchmarkCase({case:{expected:{text:'这个红灯为什么闪'}},result:{text:'这个红灯为什么闪'}});
 assert.equal(r.quality,1);assert.equal(r.details.wer,0);
});

test('engine competition executes same cases for baseline and candidate',async()=>{
 const cases=[{id:'1',assetRef:'a',category:'everyday_objects',expected:{labels:['cat']}},{id:'2',assetRef:'b',category:'everyday_objects',expected:{labels:['cat']}}];
 const baseline={id:'base',infer:async()=>({labels:['cat']})};
 const weak={id:'weak',infer:async()=>({labels:['dog']})};
 const out=await runEngineCompetition({
  engines:[baseline,weak],modality:'vision',cases,deviceProfile:{tier:'balanced'},baselineEngineId:'base',
  resolveAsset:async x=>x,scoreCase:scoreVisionBenchmarkCase,
 });
 assert.equal(out.sessions.length,2);
 assert.equal(out.decisions.find(x=>x.engineId==='base').metrics.avgQuality,1);
 assert.equal(out.decisions.find(x=>x.engineId==='weak').comparison.verdict,'REGRESSION');
});

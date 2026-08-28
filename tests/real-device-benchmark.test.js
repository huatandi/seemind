import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCorpusManifest,createCorpusCase} from '../core/perception/lab/benchmark-corpus-manifest.js';
import {BenchmarkSession} from '../core/perception/lab/benchmark-session.js';
import {deterministicCorpusSplit} from '../core/perception/lab/corpus-split.js';
import {buildBenchmarkReport} from '../core/perception/lab/benchmark-report.js';

test('corpus manifest rejects duplicate IDs and missing assets',()=>{
 const m={cases:[
  createCorpusCase({id:'x',modality:'vision',assetRef:'a.jpg',category:'everyday_objects'}),
  createCorpusCase({id:'x',modality:'vision',assetRef:'',category:'plants_animals'}),
 ]};
 const v=validateCorpusManifest(m);
 assert.equal(v.valid,false);assert.ok(v.errors.some(x=>x.startsWith('DUPLICATE_CASE_ID')));assert.ok(v.errors.some(x=>x.includes('MISSING_ASSET_REF')));
});

test('benchmark session captures real run rows and summary',()=>{
 const s=new BenchmarkSession({engineId:'vlm-a',modality:'vision',deviceProfile:{tier:'balanced'}});
 s.record({id:'1',ok:true,latencyMs:500,quality:.9});
 s.record({id:'2',ok:true,latencyMs:900,quality:.8});
 const out=s.finish();
 assert.equal(out.summary.cases,2);assert.equal(out.summary.successRate,1);assert.ok(Math.abs(out.summary.avgQuality-.85)<1e-9);
});

test('corpus split is deterministic and keeps held-out cases',()=>{
 const cases=Array.from({length:20},(_,i)=>({id:`c${i}`}));
 const a=deterministicCorpusSplit(cases,{seed:'x'}),b=deterministicCorpusSplit(cases,{seed:'x'});
 assert.deepEqual(a.validation.map(x=>x.id),b.validation.map(x=>x.id));
 assert.equal(a.validation.length,4);assert.equal(a.development.length,16);
});

test('benchmark report aggregates multiple device sessions by engine',()=>{
 const sessions=[
  {engineId:'a',modality:'vision',summary:{cases:10,successRate:1,avgQuality:.9,p50LatencyMs:500,p95LatencyMs:900}},
  {engineId:'a',modality:'vision',summary:{cases:10,successRate:.9,avgQuality:.8,p50LatencyMs:700,p95LatencyMs:1200}},
  {engineId:'b',modality:'vision',summary:{cases:20,successRate:1,avgQuality:.7,p50LatencyMs:300,p95LatencyMs:600}},
 ];
 const r=buildBenchmarkReport({sessions});
 const a=r.comparisons.find(x=>x.engineId==='a');
 assert.equal(a.cases,20);assert.equal(a.avgQuality,.85);assert.equal(a.successRate,.95);
});

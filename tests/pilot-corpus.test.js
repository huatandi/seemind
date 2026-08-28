import test from 'node:test';
import assert from 'node:assert/strict';
import {PilotCorpusBuilder} from '../core/perception/lab/pilot-corpus-builder.js';
import {auditGroundTruth} from '../core/perception/lab/ground-truth-quality.js';
import {fingerprintAsset} from '../core/perception/lab/asset-fingerprint.js';
import {runBenchmarkCases} from '../core/perception/lab/benchmark-runner.js';
import {compareAgainstBaseline} from '../core/perception/lab/baseline-comparator.js';

test('pilot builder enforces known world categories and target counts',()=>{
 const b=new PilotCorpusBuilder();
 b.addVision({assetRef:'a',category:'everyday_objects',expectedLabels:['cup']});
 b.addVoice({assetRef:'b',expectedText:'hello'});
 b.addMultimodal({assetRef:'c',expected:{target:'button',intent:'explain'}});
 const s=b.status();assert.deepEqual(s.counts,{vision:1,voice:1,multimodal:1});assert.equal(s.ready,false);
 assert.throws(()=>b.addVision({assetRef:'x',category:'receipt_only'}),/UNKNOWN_VISION_CATEGORY/);
});

test('ground truth audit blocks empty labels/transcripts/targets',()=>{
 const r=auditGroundTruth([
  {id:'v',modality:'vision',expected:{labels:[]}},
  {id:'a',modality:'voice',expected:{text:''}},
  {id:'m',modality:'multimodal',expected:{target:'',intent:''}},
 ]);
 assert.equal(r.usable,false);assert.equal(r.blocking,3);assert.equal(r.warnings,1);
});

test('asset fingerprint is stable for same bytes',async()=>{
 const a=await fingerprintAsset(new TextEncoder().encode('same'));
 const b=await fingerprintAsset(new TextEncoder().encode('same'));
 assert.equal(a,b);assert.match(a,/^(sha256|fnv1a):/);
});

test('generic benchmark runner preserves per-case failures and continues',async()=>{
 const engine={id:'e',infer:async(asset)=>{if(asset==='bad')throw new Error('bad asset');return {label:'cup'}}};
 const cases=[{id:'1',assetRef:'good',category:'everyday_objects'},{id:'2',assetRef:'bad',category:'everyday_objects'}];
 const session=await runBenchmarkCases({engine,modality:'vision',cases,resolveAsset:async x=>x,scoreCase:async({result})=>({ok:true,quality:result.label==='cup'?1:0})});
 assert.equal(session.summary.cases,2);assert.equal(session.summary.successRate,.5);assert.equal(session.rows[1].ok,false);
});

test('baseline comparator identifies faster non-regressing candidate',()=>{
 const r=compareAgainstBaseline({avgQuality:.90,successRate:.99,p50LatencyMs:500,p95LatencyMs:900},{avgQuality:.90,successRate:.99,p50LatencyMs:800,p95LatencyMs:1200});
 assert.equal(r.verdict,'IMPROVEMENT');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeFailurePatterns,buildRemediationHints} from '../core/perception/lab/failure-pattern-analyzer.js';
import {runBenchmarkCases} from '../core/perception/lab/benchmark-runner.js';

test('failure analyzer identifies repeated low-light weakness',()=>{
 const sessions=[{engineId:'vision-a',modality:'vision',results:[],rows:[
  {id:'1',ok:false,quality:.2,tags:['low_light']},
  {id:'2',ok:true,quality:.6,conditions:{low_light:true}},
  {id:'3',ok:true,quality:.95,tags:['ordinary']},
 ]}];
 const a=analyzeFailurePatterns({sessions,modality:'vision'});
 const low=a.patterns.find(x=>x.pattern==='low_light');
 assert.equal(low.cases,2);
 assert.equal(low.failures,2);
 const hints=buildRemediationHints(a);
 assert.equal(hints[0].pattern,'low_light');
 assert.match(hints[0].action,/low-light/i);
});

test('voice failure analysis separates noise and numeric weaknesses',()=>{
 const sessions=[{engineId:'asr-a',modality:'voice',rows:[
  {id:'1',ok:false,quality:.3,tags:['shop_noise','numbers']},
  {id:'2',ok:true,quality:.7,conditions:{shop_noise:true},tags:['numbers']},
  {id:'3',ok:true,quality:.96,tags:['near_mic']},
 ]}];
 const a=analyzeFailurePatterns({sessions,modality:'voice'});
 assert.ok(a.patterns.some(x=>x.pattern==='shop_noise'));
 assert.ok(a.patterns.some(x=>x.pattern==='numbers'));
});

test('benchmark runner preserves conditions needed for later failure analysis',async()=>{
 const session=await runBenchmarkCases({
  engine:{id:'x',analyze:async()=>({label:'cat'})},
  modality:'vision',
  cases:[{id:'c1',assetRef:'a',category:'animal',language:'en',tags:['low_light'],conditions:{low_light:true}}],
  resolveAsset:async()=>({}),
  scoreCase:async()=>({ok:false,quality:.2}),
 });
 assert.deepEqual(session.rows[0].tags,['low_light']);
 assert.equal(session.rows[0].conditions.low_light,true);
});

test('failure hints are evidence and never automatic retraining instructions',()=>{
 const a={patterns:[{engineId:'x',modality:'voice',pattern:'brand_model',cases:4,failures:2,failureRate:.5,avgQuality:.6}]};
 const [hint]=buildRemediationHints(a);
 assert.match(hint.principle,/do not retrain or promote automatically/i);
 assert.match(hint.action,/context/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {executeVisualCapabilities} from '../core/vision/providers/visual-provider-executor.js';

const profile=id=>({id,getProfile:()=>({capabilities:[{capability:'object_identity',score:1},{capability:'scene_context',score:1}],privacyModes:['local'],latencyClass:'medium',reliabilityScore:.8,evidenceScore:.8,historicalSuccess:.5,memoryMb:1}),healthCheck:async()=>({status:'ready'})});

test('visual capabilities share one total latency budget instead of multiplying provider timeouts',async()=>{
  const slow={...profile('slow'),analyze:()=>new Promise(r=>setTimeout(()=>r({kind:'vision'}),80))};
  const started=Date.now();
  const events=[];
  const out=await executeVisualCapabilities({image:{},capabilities:['object_identity','scene_context'],providers:[slow],deviceBudget:{maxMemoryMb:100},timeoutMs:1000,totalBudgetMs:45,onEvent:e=>events.push(e)});
  const elapsed=Date.now()-started;
  assert.ok(elapsed<160,`shared budget should bound wall time, got ${elapsed}ms`);
  assert.ok(out.unresolvedCapabilities.length>=1);
  assert.ok(events.some(e=>e.type==='visual_budget_exhausted'));
});

test('visual provider load timeout is capped by remaining total budget',async()=>{
  const hanging={...profile('hanging-load'),load:()=>new Promise(()=>{}),analyze:async()=>({kind:'vision'})};
  const started=Date.now();
  const out=await executeVisualCapabilities({image:{},capabilities:['object_identity'],providers:[hanging],deviceBudget:{maxMemoryMb:100},loadTimeoutMs:5000,totalBudgetMs:35});
  const elapsed=Date.now()-started;
  assert.ok(elapsed<160,`load should respect total budget, got ${elapsed}ms`);
  assert.deepEqual(out.unresolvedCapabilities,['object_identity']);
});

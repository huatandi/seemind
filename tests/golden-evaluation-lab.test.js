import test from 'node:test';
import assert from 'node:assert/strict';
import {GoldenDataset} from '../core/evaluation/golden-dataset.js';
import {createCoreGoldenDataset} from '../core/evaluation/golden-cases.js';
import {runGoldenDataset,compareGoldenReports,compareExpected} from '../core/evaluation/evaluation-lab.js';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';
import {analyzeFreshness} from '../core/freshness/freshness-engine.js';

test('golden dataset rejects duplicate case ids',()=>{
  assert.throws(()=>new GoldenDataset([{id:'x'},{id:'x'}]),/DUPLICATE_GOLDEN_CASE/);
});

test('core golden dataset includes critical receipt no-guess and currency recovery cases',()=>{
  const ds=createCoreGoldenDataset();
  assert.ok(ds.get('receipt-no-total-no-guess')?.critical);
  assert.ok(ds.get('receipt-currency-5-recovery')?.critical);
  assert.ok(ds.summary().caseCount>=10);
});

test('golden comparison reports exact nested mismatch paths',()=>{
  const r=compareExpected({total:{value:65638}},{total:{value:65000}});
  assert.equal(r.passed,false);
  assert.match(r.failures[0],/\$\.total\.value/);
});

test('evaluation lab runs real receipt and freshness cases',async()=>{
  const ds=createCoreGoldenDataset();
  const subset=new GoldenDataset(ds.list().filter(x=>['receipt','freshness'].includes(x.task)));
  const report=await runGoldenDataset({dataset:subset,runner:golden=>{
    if(golden.task==='receipt')return parseReceiptText(golden.input.text);
    if(golden.task==='freshness')return {requiresSearch:analyzeFreshness('这个商品现在多少钱？').required};
  }});
  assert.equal(report.failedCount,0);
  assert.equal(report.score,100);
});

test('critical golden regression blocks comparison gate',()=>{
  const baseline={score:100,caseCount:1,results:[{caseId:'receipt-no-total-no-guess',score:100,passed:true,critical:true}]};
  const candidate={score:0,caseCount:1,results:[{caseId:'receipt-no-total-no-guess',score:0,passed:false,critical:true,failures:['guessed total']}]};
  const c=compareGoldenReports(baseline,candidate);
  assert.equal(c.passed,false);
  assert.deepEqual(c.criticalRegressions,['receipt-no-total-no-guess']);
});

test('non-regressing candidate comparison passes and exposes improvements',()=>{
  const baseline={score:80,caseCount:1,results:[{caseId:'x',score:80,passed:false,critical:false}]};
  const candidate={score:100,caseCount:1,results:[{caseId:'x',score:100,passed:true,critical:false}]};
  const c=compareGoldenReports(baseline,candidate);
  assert.equal(c.passed,true);
  assert.equal(c.improvements.length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createMexicanReceiptGoldenSuite} from '../core/evaluation/mexican-receipt-golden-suite.js';
import {runGoldenDataset} from '../core/evaluation/evaluation-lab.js';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';

test('Mexican Receipt Golden Suite has broad coverage and critical cases',()=>{
  const ds=createMexicanReceiptGoldenSuite();
  const s=ds.summary();
  assert.ok(s.caseCount>=30);
  assert.ok(s.criticalCount>=10);
  assert.equal(s.byTask.receipt,s.caseCount);
});

test('Mexican Receipt Golden Suite passes against current deterministic parser',async()=>{
  const ds=createMexicanReceiptGoldenSuite();
  const report=await runGoldenDataset({dataset:ds,candidateId:'receipt-parser-v0.22',runner:g=>parseReceiptText(g.input.text)});
  assert.equal(report.failedCount,0,JSON.stringify(report.results.filter(x=>!x.passed),null,2));
  assert.equal(report.score,100);
});

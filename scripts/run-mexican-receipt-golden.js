import {createMexicanReceiptGoldenSuite} from '../core/evaluation/mexican-receipt-golden-suite.js';
import {runGoldenDataset} from '../core/evaluation/evaluation-lab.js';
import {parseReceiptText} from '../features/receipt/receipt-parser.js';

const dataset=createMexicanReceiptGoldenSuite();
const report=await runGoldenDataset({
  dataset,
  candidateId:'receipt-parser-current',
  runner:g=>parseReceiptText(g.input.text),
  metadata:{suite:'mexican-receipt-v0.22'}
});
console.log(JSON.stringify({
  suite:'Mexican Receipt Golden Suite',
  cases:report.caseCount,
  passed:report.passedCount,
  failed:report.failedCount,
  score:report.score,
  criticalFailures:report.criticalFailures,
  failedCases:report.results.filter(x=>!x.passed).map(x=>({caseId:x.caseId,failures:x.failures}))
},null,2));
if(report.failedCount||report.criticalFailures.length)process.exitCode=1;

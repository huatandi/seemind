import {OcrBenchmarkDataset,runOcrBenchmark,compareOcrStrategies} from '../core/evaluation/ocr-benchmark.js';
import {createOcrPromotionCandidate} from '../core/evaluation/ocr-promotion-gate.js';

const expected={date:{value:'2026-08-20'},subtotal:{value:10000},tax:{value:800},total:{value:10800}};
const cases=[
  ['easy-super-1','easy','supermarket'],
  ['easy-super-2','easy','supermarket'],
  ['medium-super-1','medium','supermarket'],
  ['medium-gas-1','medium','gas-station'],
  ['hard-super-1','hard','supermarket'],
  ['hard-gas-1','hard','gas-station'],
].map(([id,difficulty,receiptType])=>({id,difficulty,receiptType,expected,criticalFields:['date','total']}));

const dataset=new OcrBenchmarkDataset(cases);
const strategies={
  paddle:async({golden})=>({
    receipt:golden.difficulty==='hard'?{...expected,total:{value:10900}}:expected,
    evidenceScore:golden.difficulty==='hard'?76:92,
    recognitions:1,
  }),
  tesseract:async({golden})=>({
    receipt:golden.difficulty==='easy'?expected:{...expected,date:{value:null}},
    evidenceScore:golden.difficulty==='easy'?88:72,
    recognitions:golden.difficulty==='hard'?2:1,
  }),
  ensemble:async({golden})=>({
    receipt:expected,
    evidenceScore:95,
    recognitions:golden.difficulty==='hard'?2:1,
    fallbackUsed:golden.difficulty==='hard',
  }),
};

const report=await runOcrBenchmark({dataset,strategies});
const comparison=compareOcrStrategies(report,{minimumCases:5});
const candidate=createOcrPromotionCandidate({benchmarkComparison:comparison});

console.log(JSON.stringify({
  suite:'OCR Benchmark Framework Lab',
  note:'Synthetic deterministic benchmark. This is not a claim of real Paddle/Tesseract image accuracy.',
  cases:report.caseCount,
  aggregate:report.aggregate,
  overallRanking:comparison.overallRanking,
  recommendation:comparison.recommendation,
  promotionCandidate:{status:candidate.status,strategyId:candidate.strategyId??null},
},null,2));

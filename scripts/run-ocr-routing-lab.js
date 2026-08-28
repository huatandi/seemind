import {OcrEngine} from '../core/ocr/ocr-engine.js';
import {OcrEnginePerformanceStore} from '../core/ocr/ocr-engine-performance.js';
import {routeOcrEngines} from '../core/ocr/ocr-adaptive-router.js';

class E extends OcrEngine{
  constructor(id,priority=50,caps={text:true}){super(id,{priority,languages:['spa','eng'],capabilities:caps})}
  async recognize(){return this.normalize({engineId:this.id,text:'TOTAL 10.00',confidence:.8})}
}
const paddle=new E('paddle-ocr',85,{text:true,bboxes:true,orientation:true});
const tess=new E('tesseract-js',50,{text:true});
const cases=[
  ['easy-primary-fallback',()=>routeOcrEngines({engines:[paddle,tess],quality:{score:.9,flags:[]}}).strategy==='primary-with-fallback'],
  ['hard-dual',()=>routeOcrEngines({engines:[paddle,tess],quality:{score:.3,flags:['low_contrast','blurry_or_low_detail']}}).strategy==='dual-competition'],
  ['history-reranks',()=>{
    const p=new OcrEnginePerformanceStore({
      'paddle-ocr':{attempts:10,successes:4,failures:6,avgLatencyMs:5000,avgEvidenceScore:55,consecutiveFailures:2},
      'tesseract-js':{attempts:10,successes:9,failures:1,avgLatencyMs:800,avgEvidenceScore:88}
    });
    return routeOcrEngines({engines:[paddle,tess],quality:{score:.9,flags:[]},performanceStore:p}).engines[0].id==='tesseract-js';
  }],
  ['low-power-budget',()=>{
    const r=routeOcrEngines({engines:[paddle,tess],quality:{score:.25,flags:['low_contrast','blurry_or_low_detail']},deviceClass:'low_power'});
    return r.budget.maxTotalRecognitions===2;
  }],
];
let passed=0,failed=[];
for(const [id,fn] of cases){try{if(fn())passed++;else failed.push(id)}catch(e){failed.push(`${id}:${e.message}`)}}
console.log(JSON.stringify({suite:'OCR Adaptive Routing Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

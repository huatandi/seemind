import {buildCorpusPackage} from '../core/evaluation/receipt-corpus/corpus-package.js';
import {runRealOcrBenchmark} from '../core/evaluation/receipt-corpus/real-benchmark-runner.js';

function gt(id){
  return {caseId:id,imageRef:`images/${id}.jpg`,difficulty:'medium',receiptType:'supermarket',
    fields:{
      merchant:{value:'TIENDA',status:'confirmed'},date:{value:'2026-08-20',status:'confirmed'},
      subtotal:{value:10000,status:'confirmed'},tax:{value:800,status:'confirmed'},discount:{value:null,status:'not_applicable'},
      total:{value:10800,status:'confirmed'},cash:{value:null,status:'not_applicable'},change:{value:null,status:'not_applicable'}
    },
    criticalFields:['date','total'],tags:['lab'],
    annotation:{status:'reviewed',annotatorId:'lab-a',reviewedBy:'lab-r',reviewedAt:'2026-08-25T00:00:00Z'},
    provenance:{source:'synthetic-lab',consentConfirmed:true,redacted:true},workflow:{stage:'eligible'}};
}
const ids=['a','b','c','d','e'];
const images=ids.map(id=>({path:`images/${id}.jpg`,bytes:Buffer.from(`synthetic-image-${id}`),mimeType:'image/jpeg'}));
const pkg=buildCorpusPackage({datasetId:'v034-framework-lab',version:'1',items:ids.map(id=>({draft:gt(id)})),imageEntries:images});
const truth={merchant:{value:'TIENDA'},date:{value:'2026-08-20'},subtotal:{value:10000},tax:{value:800},discount:{value:null},total:{value:10800},cash:{value:null},change:{value:null}};
const result=await runRealOcrBenchmark({
  corpusPackage:pkg,imageEntries:images,minimumCases:5,
  strategies:{
    frameworkA:{available:true,run:async()=>({receipt:truth,evidenceScore:95,recognitions:1})},
    frameworkB:{available:true,run:async()=>({receipt:{...truth,total:{value:99999}},evidenceScore:70,recognitions:1})},
  }
});
console.log(JSON.stringify({
  suite:'Real OCR Benchmark Runner Lab',
  note:'Synthetic byte fixtures and deterministic fake strategies. This validates real-runner plumbing only; it is NOT a real Paddle/Tesseract accuracy result.',
  status:result.status,
  cases:result.dataset?.cases??0,
  manifestHash:result.dataset?.contentHash??null,
  packageHash:result.dataset?.packageHash??null,
  recommendation:result.comparison?.recommendation??null,
  score:result.status==='executed'?100:0
},null,2));

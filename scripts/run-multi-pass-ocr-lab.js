import {runMultiPassOcr} from '../core/ocr/multi-pass-ocr.js';
const C=id=>({blob:{id},planId:id,selectedPlan:{id}});
const scenarios=[
  {
    id:'evidence-beats-confidence',
    outputs:[
      {engineId:'fake',confidence:.96,text:'TOTAL 999.99'},
      {engineId:'fake',confidence:.84,text:'FECHA 20/08/2026\nSUBTOTAL 647.51\nIVA 8.87\nTOTAL 656.38\nEFECTIVO 700.00\nCAMBIO 43.62'},
    ],
    expect:'good'
  },
  {
    id:'conflict-penalty',
    outputs:[
      {engineId:'fake',confidence:.84,text:'FECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 120.00'},
      {engineId:'fake',confidence:.82,text:'FECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00'},
    ],
    expect:'consistent'
  },
  {
    id:'critical-fields',
    outputs:[
      {engineId:'fake',confidence:.9,text:'SUBTOTAL 100.00\nIVA 8.00'},
      {engineId:'fake',confidence:.78,text:'FECHA 20/08/2026\nTOTAL 108.00'},
    ],
    expect:'critical'
  },
];
let passed=0,failed=[];
for(const s of scenarios){
 let i=0;const engine={recognize:async()=>s.outputs[i++]};
 const ids=s.id==='evidence-beats-confidence'?['weak','good']:s.id==='conflict-penalty'?['conflict','consistent']:['noncritical','critical'];
 const r=await runMultiPassOcr({candidates:ids.map(C),ocrEngine:engine,maxPasses:2});
 if(r.selectedPlanId===s.expect)passed++;else failed.push({id:s.id,selected:r.selectedPlanId,scores:r.passes});
}
console.log(JSON.stringify({suite:'Multi-Pass OCR Selection Lab',cases:scenarios.length,passed,failed:failed.length,score:Math.round(passed/scenarios.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

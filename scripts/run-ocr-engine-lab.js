import {OcrEngine} from '../core/ocr/ocr-engine.js';
import {OcrEngineRegistry} from '../core/ocr/ocr-engine-registry.js';
import {PaddleOcrEngine} from '../providers/local/paddle-ocr.js';
import {runOcrEnsemble} from '../core/ocr/ocr-ensemble.js';

class F extends OcrEngine{
  constructor(id,outputs,priority=50){super(id,{version:'lab',languages:['spa','eng'],capabilities:{text:true},priority});this.o=[...outputs];this.i=0}
  async recognize(){return this.normalize({...this.o[Math.min(this.i++,this.o.length-1)],engineId:this.id})}
}
const C=id=>({blob:{id},planId:id,selectedPlan:{id}});
let passed=0,failed=[];
async function check(id,fn){try{if(await fn())passed++;else failed.push(id)}catch(e){failed.push(`${id}:${e.message}`)}}

await check('registry-capability',async()=>{
 const r=new OcrEngineRegistry([new F('a',[{text:'x',confidence:.5}],20),new F('b',[{text:'x',confidence:.5}],80)]);
 return r.list()[0].id==='b';
});
await check('paddle-contract',async()=>{
 const p=new PaddleOcrEngine({runner:async()=>({text:'TOTAL 100.00',confidence:92,lines:[{text:'TOTAL 100.00',confidence:95}]})});
 const x=await p.recognize({});return x.engineId==='paddle-ocr'&&x.confidence===.92;
});
await check('ensemble-evidence-wins',async()=>{
 const weak=new F('weak',[{text:'TOTAL 999.99',confidence:.97}],90);
 const strong=new F('strong',[{text:'FECHA 20/08/2026\nSUBTOTAL 100.00\nIVA 8.00\nTOTAL 108.00',confidence:.8}],50);
 const x=await runOcrEnsemble({candidates:[C('a')],engines:[weak,strong],maxEngines:2,maxPassesPerEngine:1,maxTotalRecognitions:2});
 return x.selectedEngineId==='strong';
});
await check('global-budget',async()=>{
 const a=new F('a',Array(4).fill({text:'TOTAL 10.00',confidence:.5}));
 const b=new F('b',Array(4).fill({text:'TOTAL 10.00',confidence:.6}));
 const x=await runOcrEnsemble({candidates:[C('1'),C('2'),C('3')],engines:[a,b],maxEngines:2,maxPassesPerEngine:3,maxTotalRecognitions:4});
 return x.totalRecognitions===4&&a.i+b.i===4;
});
console.log(JSON.stringify({suite:'OCR Engine Abstraction Lab',cases:4,passed,failed:failed.length,score:Math.round(passed/4*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCorpusPackage,verifyCorpusPackage} from '../core/evaluation/receipt-corpus/corpus-package.js';
import {preflightRealOcrBenchmark,runRealOcrBenchmark} from '../core/evaluation/receipt-corpus/real-benchmark-runner.js';

function eligible(id='r1',imageRef=`images/${id}.jpg`){
  return {caseId:id,imageRef,difficulty:'medium',receiptType:'supermarket',
    fields:{
      merchant:{value:'TIENDA',status:'confirmed'},date:{value:'2026-08-20',status:'confirmed'},
      subtotal:{value:10000,status:'confirmed'},tax:{value:800,status:'confirmed'},discount:{value:null,status:'not_applicable'},
      total:{value:10800,status:'confirmed'},cash:{value:null,status:'not_applicable'},change:{value:null,status:'not_applicable'}
    },
    criticalFields:['date','total'],tags:['mexico'],
    annotation:{status:'reviewed',annotatorId:'a',reviewedBy:'r',reviewedAt:'2026-08-25T00:00:00Z'},
    provenance:{source:'user-provided',consentConfirmed:true,redacted:true},
    workflow:{stage:'eligible'}
  };
}
const bytes=s=>Buffer.from(s);

test('corpus package includes only eligible cases',()=>{
  const pkg=buildCorpusPackage({
    datasetId:'mx',version:'1.0',
    items:[
      {draft:eligible('a')},
      {draft:{...eligible('b'),workflow:{stage:'review'}}}
    ],
    imageEntries:[{path:'images/a.jpg',bytes:bytes('a'),mimeType:'image/jpeg'}]
  });
  assert.equal(pkg.manifest.caseCount,1);
  assert.equal(pkg.manifest.cases[0].caseId,'a');
});

test('corpus package records missing image instead of pretending complete',()=>{
  const pkg=buildCorpusPackage({items:[{draft:eligible('a')}],imageEntries:[]});
  assert.equal(pkg.integrity.imageComplete,false);
  assert.deepEqual(pkg.integrity.missingImages,['images/a.jpg']);
});

test('corpus package image hash detects tampering',()=>{
  const img={path:'images/a.jpg',bytes:bytes('ORIGINAL'),mimeType:'image/jpeg'};
  const pkg=buildCorpusPackage({items:[{draft:eligible('a')}],imageEntries:[img]});
  assert.equal(verifyCorpusPackage(pkg,{imageEntries:[img]}).valid,true);
  const changed={...img,bytes:bytes('CHANGED')};
  const v=verifyCorpusPackage(pkg,{imageEntries:[changed]});
  assert.equal(v.valid,false);
  assert.deepEqual(v.mismatchedImages,['images/a.jpg']);
});

test('real benchmark preflight refuses to run without real images',()=>{
  const pkg=buildCorpusPackage({items:[{draft:eligible('a')}],imageEntries:[]});
  const p=preflightRealOcrBenchmark({corpusPackage:pkg,imageEntries:[],strategies:{tess:{available:true,run:async()=>({})}}});
  assert.equal(p.ready,false);
  assert.ok(p.reasons.includes('CORPUS_IMAGES_MISSING'));
});

test('real benchmark preflight distinguishes unavailable OCR strategies',()=>{
  const img={path:'images/a.jpg',bytes:bytes('img'),mimeType:'image/jpeg'};
  const pkg=buildCorpusPackage({items:[{draft:eligible('a')}],imageEntries:[img]});
  const p=preflightRealOcrBenchmark({
    corpusPackage:pkg,imageEntries:[img],
    strategies:{paddle:{available:false,reason:'PADDLE_RUNTIME_UNAVAILABLE'},tess:{available:true,run:async()=>({})}}
  });
  assert.equal(p.ready,true);
  assert.deepEqual(p.availableStrategies,['tess']);
  assert.equal(p.unavailableStrategies[0].id,'paddle');
});

test('real benchmark returns not_executed instead of fake score when preflight fails',async()=>{
  const pkg=buildCorpusPackage({items:[{draft:eligible('a')}],imageEntries:[]});
  const r=await runRealOcrBenchmark({corpusPackage:pkg,imageEntries:[],strategies:{}});
  assert.equal(r.status,'not_executed');
  assert.equal(r.report,null);
  assert.equal(r.comparison,null);
});

test('real benchmark executes identical corpus through available strategies',async()=>{
  const imgs=[
    {path:'images/a.jpg',bytes:bytes('a'),mimeType:'image/jpeg'},
    {path:'images/b.jpg',bytes:bytes('b'),mimeType:'image/jpeg'},
    {path:'images/c.jpg',bytes:bytes('c'),mimeType:'image/jpeg'},
    {path:'images/d.jpg',bytes:bytes('d'),mimeType:'image/jpeg'},
    {path:'images/e.jpg',bytes:bytes('e'),mimeType:'image/jpeg'},
  ];
  const items=imgs.map((x,i)=>({draft:eligible(String.fromCharCode(97+i),x.path)}));
  const pkg=buildCorpusPackage({datasetId:'mx-real',version:'1',items,imageEntries:imgs});
  const gt={merchant:{value:'TIENDA'},date:{value:'2026-08-20'},subtotal:{value:10000},tax:{value:800},discount:{value:null},total:{value:10800},cash:{value:null},change:{value:null}};
  const result=await runRealOcrBenchmark({
    corpusPackage:pkg,imageEntries:imgs,minimumCases:5,
    strategies:{
      paddle:{available:true,run:async()=>({receipt:gt,evidenceScore:95,recognitions:1})},
      tess:{available:true,run:async()=>({receipt:{...gt,total:{value:99999}},evidenceScore:70,recognitions:1})},
    }
  });
  assert.equal(result.status,'executed');
  assert.equal(result.dataset.cases,5);
  assert.equal(result.report.aggregate.paddle.totalAccuracy,1);
  assert.equal(result.comparison.recommendation.strategyId,'paddle');
});

test('clean package strips workflow and student suggestions from manifest',()=>{
  const d=eligible('a');
  d.fields.total.suggestion={value:10800,confidence:.99};
  const img={path:'images/a.jpg',bytes:bytes('a')};
  const pkg=buildCorpusPackage({items:[{draft:d}],imageEntries:[img]});
  assert.equal('workflow' in pkg.manifest.cases[0],false);
  assert.equal('suggestion' in pkg.manifest.cases[0].fields.total,false);
});

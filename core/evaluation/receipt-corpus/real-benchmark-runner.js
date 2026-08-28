import {corpusManifestToBenchmarkDataset} from './benchmark-adapter.js';
import {verifyCorpusPackage} from './corpus-package.js';
import {runOcrBenchmark,compareOcrStrategies} from '../ocr-benchmark.js';

export function preflightRealOcrBenchmark({corpusPackage,imageEntries=[],strategies={}}={}){
  if(!corpusPackage)return {ready:false,status:'not_executed',reasons:['CORPUS_PACKAGE_REQUIRED']};
  const integrity=verifyCorpusPackage(corpusPackage,{imageEntries});
  const reasons=[];
  if(!integrity.manifestValid)reasons.push('CORPUS_MANIFEST_INVALID');
  if(integrity.missingImages.length)reasons.push('CORPUS_IMAGES_MISSING');
  if(integrity.mismatchedImages.length)reasons.push('CORPUS_IMAGE_HASH_MISMATCH');
  const available=Object.entries(strategies).filter(([,s])=>s?.available!==false&&typeof s?.run==='function');
  if(!available.length)reasons.push('NO_REAL_OCR_STRATEGY_AVAILABLE');
  return {
    ready:reasons.length===0,
    status:reasons.length?'not_executed':'ready',
    reasons,
    integrity,
    availableStrategies:available.map(([id])=>id),
    unavailableStrategies:Object.entries(strategies).filter(([,s])=>s?.available===false||typeof s?.run!=='function').map(([id,s])=>({id,reason:s?.reason??'UNAVAILABLE'})),
  };
}

export async function runRealOcrBenchmark({corpusPackage,imageEntries=[],strategies={},minimumCases=5}={}){
  const preflight=preflightRealOcrBenchmark({corpusPackage,imageEntries,strategies});
  if(!preflight.ready)return {
    schemaVersion:1,
    mode:'real',
    status:'not_executed',
    preflight,
    report:null,
    comparison:null,
  };

  const byPath=new Map(imageEntries.map(x=>[String(x.path),x]));
  const dataset=corpusManifestToBenchmarkDataset(corpusPackage.manifest,{requireValid:true});
  const runners=Object.fromEntries(Object.entries(strategies)
    .filter(([,s])=>s?.available!==false&&typeof s?.run==='function')
    .map(([id,s])=>[id,async({golden,input})=>s.run({golden,image:input,bytes:input.bytes,mimeType:input.mimeType})]));

  const report=await runOcrBenchmark({
    dataset,
    strategies:runners,
    caseLoader:async golden=>{
      const entry=byPath.get(golden.image.ref);
      if(!entry?.bytes){const e=new Error('REAL_BENCHMARK_IMAGE_MISSING');e.code='REAL_BENCHMARK_IMAGE_MISSING';throw e}
      return {ref:golden.image.ref,bytes:entry.bytes,mimeType:entry.mimeType??'application/octet-stream'};
    },
  });
  const comparison=compareOcrStrategies(report,{minimumCases});
  return {
    schemaVersion:1,
    mode:'real',
    status:'executed',
    dataset:{
      id:corpusPackage.manifest.datasetId,
      version:corpusPackage.manifest.version,
      contentHash:corpusPackage.manifest.contentHash,
      packageHash:corpusPackage.integrity.packageHash,
      cases:corpusPackage.manifest.caseCount,
    },
    preflight,
    report,
    comparison,
  };
}

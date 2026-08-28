import {OcrBenchmarkDataset} from '../ocr-benchmark.js';
import {verifyReceiptCorpusManifest} from './corpus-manifest.js';

export function corpusManifestToBenchmarkDataset(manifest,{requireValid=true}={}){
  const verification=verifyReceiptCorpusManifest(manifest);
  if(requireValid&&!verification.valid)throw new Error('RECEIPT_CORPUS_INVALID');
  return new OcrBenchmarkDataset((manifest.cases??[]).map(c=>({
    id:c.caseId,difficulty:c.difficulty,receiptType:c.receiptType,tags:c.tags,
    image:{ref:c.imageRef},
    expected:Object.fromEntries(Object.entries(c.fields).map(([k,v])=>[k,{...v}])),
    criticalFields:c.criticalFields,
    metadata:{datasetId:manifest.datasetId,datasetVersion:manifest.version,contentHash:manifest.contentHash},
  })));
}

import {createHash} from 'node:crypto';
import {normalizeGroundTruth} from './ground-truth-schema.js';
import {validateReceiptCorpus} from './corpus-validator.js';

export function buildReceiptCorpusManifest({datasetId='mx-receipts',version='0.1.0',cases=[]}={}){
  const normalized=cases.map(normalizeGroundTruth).sort((a,b)=>a.caseId.localeCompare(b.caseId));
  const validation=validateReceiptCorpus(normalized,{strict:true});
  const contentHash=sha256(stable(normalized));
  return {
    schemaVersion:1,datasetId:String(datasetId),version:String(version),
    createdAt:new Date().toISOString(),caseCount:normalized.length,
    contentHash:`sha256:${contentHash}`,
    validation:{valid:validation.valid,invalidCount:validation.invalidCount},
    distributions:{
      difficulty:count(normalized,'difficulty'),
      receiptType:count(normalized,'receiptType'),
    },
    cases:normalized,
  };
}
export function verifyReceiptCorpusManifest(manifest){
  const expected=`sha256:${sha256(stable([...(manifest?.cases??[])].sort((a,b)=>a.caseId.localeCompare(b.caseId))))}`;
  const validation=validateReceiptCorpus(manifest?.cases??[],{strict:true});
  return {valid:expected===manifest?.contentHash&&validation.valid,hashMatches:expected===manifest?.contentHash,validation};
}
function count(a,k){const o={};for(const x of a)o[x[k]]=(o[x[k]]??0)+1;return o}
function stable(v){return JSON.stringify(sort(v))}
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v}
function sha256(s){return createHash('sha256').update(s).digest('hex')}

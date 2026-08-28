import {createHash} from 'node:crypto';
import {buildReceiptCorpusManifest,verifyReceiptCorpusManifest} from './corpus-manifest.js';

export function buildCorpusPackage({datasetId='mx-receipts',version='0.1.0',items=[],imageEntries=[]}={}){
  const eligible=items.filter(x=>x?.draft?.workflow?.stage==='eligible').map(x=>cleanGroundTruth(x.draft));
  if(!eligible.length)throw new Error('NO_ELIGIBLE_CORPUS_CASES');
  const manifest=buildReceiptCorpusManifest({datasetId,version,cases:eligible});
  if(!manifest.validation.valid)throw new Error('ELIGIBLE_CORPUS_INVALID');

  const byPath=new Map(imageEntries.map(x=>[String(x.path),x]));
  const files=manifest.cases.map(c=>{
    const entry=byPath.get(c.imageRef);
    return {
      caseId:c.caseId,
      imageRef:c.imageRef,
      present:Boolean(entry?.bytes),
      size:entry?.bytes?.length??0,
      sha256:entry?.bytes?`sha256:${sha256(entry.bytes)}`:null,
      mimeType:entry?.mimeType??null,
    };
  });

  const imageComplete=files.every(x=>x.present);
  const packageHash=sha256(JSON.stringify({
    datasetId:manifest.datasetId,
    version:manifest.version,
    manifestHash:manifest.contentHash,
    files:files.map(x=>({caseId:x.caseId,imageRef:x.imageRef,sha256:x.sha256,size:x.size})),
  }));

  return {
    schemaVersion:1,
    packageId:`${manifest.datasetId}@${manifest.version}`,
    createdAt:new Date().toISOString(),
    manifest,
    files,
    integrity:{
      manifestValid:verifyReceiptCorpusManifest(manifest).valid,
      imageComplete,
      missingImages:files.filter(x=>!x.present).map(x=>x.imageRef),
      packageHash:`sha256:${packageHash}`,
    },
  };
}

export function verifyCorpusPackage(pkg,{imageEntries=[]}={}){
  const manifestCheck=verifyReceiptCorpusManifest(pkg?.manifest??{});
  const byPath=new Map(imageEntries.map(x=>[String(x.path),x]));
  const fileResults=(pkg?.files??[]).map(f=>{
    const entry=byPath.get(f.imageRef);
    const actual=entry?.bytes?`sha256:${sha256(entry.bytes)}`:null;
    return {caseId:f.caseId,imageRef:f.imageRef,present:Boolean(entry?.bytes),hashMatches:Boolean(actual&&actual===f.sha256),expected:f.sha256,actual};
  });
  return {
    valid:manifestCheck.valid&&fileResults.every(x=>x.present&&x.hashMatches),
    manifestValid:manifestCheck.valid,
    files:fileResults,
    missingImages:fileResults.filter(x=>!x.present).map(x=>x.imageRef),
    mismatchedImages:fileResults.filter(x=>x.present&&!x.hashMatches).map(x=>x.imageRef),
  };
}

function cleanGroundTruth(draft){
  const c=JSON.parse(JSON.stringify(draft));
  for(const f of Object.values(c.fields??{}))delete f.suggestion;
  delete c.workflow;
  return c;
}
function sha256(input){return createHash('sha256').update(input).digest('hex')}

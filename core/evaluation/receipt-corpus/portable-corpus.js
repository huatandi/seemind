import {createHash} from 'node:crypto';
import {buildCorpusPackage,verifyCorpusPackage} from './corpus-package.js';

export function exportPortableCorpus({datasetId='mx-receipts',version='0.1.0',items=[],imageEntries=[]}={}){
  const pkg=buildCorpusPackage({datasetId,version,items,imageEntries});
  if(!pkg.integrity.imageComplete)throw Object.assign(new Error('PORTABLE_CORPUS_IMAGES_INCOMPLETE'),{missingImages:pkg.integrity.missingImages});
  const byPath=new Map(imageEntries.map(x=>[String(x.path),x]));
  const entries=[
    {path:'corpus-package.json',mimeType:'application/json',bytes:Buffer.from(JSON.stringify(pkg,null,2))},
    ...pkg.files.map(f=>{
      const image=byPath.get(f.imageRef);
      return {path:f.imageRef,mimeType:image.mimeType??f.mimeType??'application/octet-stream',bytes:Buffer.from(image.bytes)};
    }),
  ];
  const archiveManifest=buildArchiveManifest(entries);
  const manifestBytes=Buffer.from(JSON.stringify(archiveManifest,null,2));
  return {
    format:'seemind-portable-corpus',
    formatVersion:1,
    package:pkg,
    archiveManifest,
    entries:[...entries,{path:'archive-manifest.json',mimeType:'application/json',bytes:manifestBytes}],
  };
}

export function importPortableCorpus({entries=[]}={}){
  const normalized=entries.map(x=>({path:normalizePath(x.path),mimeType:x.mimeType??null,bytes:Buffer.from(x.bytes??[])}));
  const duplicates=findDuplicates(normalized.map(x=>x.path));
  if(duplicates.length)return reject('PORTABLE_CORPUS_DUPLICATE_PATH',{duplicates});
  const archiveEntry=normalized.find(x=>x.path==='archive-manifest.json');
  const packageEntry=normalized.find(x=>x.path==='corpus-package.json');
  if(!archiveEntry)return reject('PORTABLE_CORPUS_ARCHIVE_MANIFEST_MISSING');
  if(!packageEntry)return reject('PORTABLE_CORPUS_PACKAGE_MISSING');

  let archiveManifest,pkg;
  try{archiveManifest=JSON.parse(archiveEntry.bytes.toString('utf8'))}catch{return reject('PORTABLE_CORPUS_ARCHIVE_MANIFEST_INVALID_JSON')}
  try{pkg=JSON.parse(packageEntry.bytes.toString('utf8'))}catch{return reject('PORTABLE_CORPUS_PACKAGE_INVALID_JSON')}
  if(archiveManifest?.format!=='seemind-portable-corpus'||archiveManifest?.formatVersion!==1)return reject('PORTABLE_CORPUS_FORMAT_UNSUPPORTED');

  const payload=normalized.filter(x=>x.path!=='archive-manifest.json');
  const actualManifest=buildArchiveManifest(payload);
  const expectedFiles=archiveManifest.files??[];
  if(JSON.stringify(actualManifest.files)!==JSON.stringify(expectedFiles))return reject('PORTABLE_CORPUS_ARCHIVE_HASH_MISMATCH',{expected:expectedFiles,actual:actualManifest.files});

  const imageEntries=pkg.files.map(f=>{
    const e=normalized.find(x=>x.path===normalizePath(f.imageRef));
    return e?{path:f.imageRef,mimeType:e.mimeType??f.mimeType,bytes:e.bytes}:null;
  }).filter(Boolean);
  const verification=verifyCorpusPackage(pkg,{imageEntries});
  if(!verification.valid)return reject('PORTABLE_CORPUS_PACKAGE_VERIFICATION_FAILED',{verification});

  return {valid:true,status:'accepted',package:pkg,imageEntries,archiveManifest,verification};
}

export function bindPortableImages(corpusPackage,candidates=[]){
  const expected=new Map((corpusPackage?.files??[]).map(x=>[x.imageRef,x]));
  const bindings=[],unmatched=[];
  for(const c of candidates){
    const path=normalizePath(c.path);
    const direct=expected.get(path);
    const hash=`sha256:${sha256(Buffer.from(c.bytes??[]))}`;
    const byHash=[...expected.values()].find(x=>x.sha256===hash);
    const match=direct??byHash;
    if(match)bindings.push({caseId:match.caseId,imageRef:match.imageRef,path,matchMode:direct?'path':'sha256',bytes:Buffer.from(c.bytes??[]),mimeType:c.mimeType??match.mimeType});
    else unmatched.push(path);
  }
  const boundRefs=new Set(bindings.map(x=>x.imageRef));
  return {bindings,unmatched,missing:[...expected.keys()].filter(x=>!boundRefs.has(x)),complete:boundRefs.size===expected.size};
}

function buildArchiveManifest(entries){
  const files=[...entries].map(x=>({path:normalizePath(x.path),size:Buffer.from(x.bytes??[]).length,sha256:`sha256:${sha256(Buffer.from(x.bytes??[]))}`,mimeType:x.mimeType??null})).sort((a,b)=>a.path.localeCompare(b.path));
  return {format:'seemind-portable-corpus',formatVersion:1,files,contentHash:`sha256:${sha256(JSON.stringify(files))}`};
}
function normalizePath(p){return String(p??'').replace(/\\/g,'/').replace(/^\.?\//,'')}
function findDuplicates(a){return [...new Set(a.filter((x,i)=>a.indexOf(x)!==i))]}
function reject(reason,extra={}){return {valid:false,status:'rejected',reason,...extra}}
function sha256(input){return createHash('sha256').update(input).digest('hex')}

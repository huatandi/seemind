import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPortableCorpus,importPortableCorpus,bindPortableImages} from '../core/evaluation/receipt-corpus/portable-corpus.js';

function eligible(id='r1',imageRef=`images/${id}.jpg`){
 return {caseId:id,imageRef,difficulty:'medium',receiptType:'supermarket',
 fields:{merchant:{value:'TIENDA',status:'confirmed'},date:{value:'2026-08-20',status:'confirmed'},subtotal:{value:10000,status:'confirmed'},tax:{value:800,status:'confirmed'},discount:{value:null,status:'not_applicable'},total:{value:10800,status:'confirmed'},cash:{value:null,status:'not_applicable'},change:{value:null,status:'not_applicable'}},
 criticalFields:['date','total'],tags:['mexico'],annotation:{status:'reviewed',annotatorId:'a',reviewedBy:'r',reviewedAt:'2026-08-25T00:00:00Z'},provenance:{source:'user-provided',consentConfirmed:true,redacted:true},workflow:{stage:'eligible'}};
}
const img=(id,content=id)=>({path:`images/${id}.jpg`,mimeType:'image/jpeg',bytes:Buffer.from(content)});

test('portable export refuses incomplete image binding',()=>{
 assert.throws(()=>exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[]}),/PORTABLE_CORPUS_IMAGES_INCOMPLETE/);
});

test('portable export includes package, images, and archive manifest',()=>{
 const x=exportPortableCorpus({datasetId:'mx',version:'1',items:[{draft:eligible('a')}],imageEntries:[img('a')]});
 assert.deepEqual(x.entries.map(e=>e.path).sort(),['archive-manifest.json','corpus-package.json','images/a.jpg']);
 assert.equal(x.package.integrity.imageComplete,true);
});

test('portable corpus round trip preserves verified package and image bytes',()=>{
 const x=exportPortableCorpus({datasetId:'mx',version:'1',items:[{draft:eligible('a')},{draft:eligible('b')}],imageEntries:[img('a'),img('b')]});
 const y=importPortableCorpus({entries:x.entries});
 assert.equal(y.valid,true);assert.equal(y.package.manifest.caseCount,2);
 assert.equal(y.imageEntries.length,2);assert.equal(y.verification.valid,true);
});

test('import rejects a modified receipt image',()=>{
 const x=exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[img('a','ORIGINAL')]});
 const entries=x.entries.map(e=>e.path==='images/a.jpg'?{...e,bytes:Buffer.from('CHANGED')}:e);
 const y=importPortableCorpus({entries});
 assert.equal(y.valid,false);assert.equal(y.reason,'PORTABLE_CORPUS_ARCHIVE_HASH_MISMATCH');
});

test('import rejects modified Ground Truth package',()=>{
 const x=exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[img('a')]});
 const entries=x.entries.map(e=>e.path==='corpus-package.json'?{...e,bytes:Buffer.from(e.bytes.toString().replace('10800','99999'))}:e);
 const y=importPortableCorpus({entries});
 assert.equal(y.valid,false);assert.equal(y.reason,'PORTABLE_CORPUS_ARCHIVE_HASH_MISMATCH');
});

test('import rejects missing image even if other metadata remains',()=>{
 const x=exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[img('a')]});
 const y=importPortableCorpus({entries:x.entries.filter(e=>e.path!=='images/a.jpg')});
 assert.equal(y.valid,false);assert.equal(y.reason,'PORTABLE_CORPUS_ARCHIVE_HASH_MISMATCH');
});

test('image rebinding can recover renamed image by sha256',()=>{
 const x=exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[img('a','SAME')]});
 const r=bindPortableImages(x.package,[{path:'renamed/photo.jpg',bytes:Buffer.from('SAME'),mimeType:'image/jpeg'}]);
 assert.equal(r.complete,true);assert.equal(r.bindings[0].matchMode,'sha256');assert.equal(r.bindings[0].imageRef,'images/a.jpg');
});

test('image rebinding never accepts same filename with wrong bytes as complete',()=>{
 const x=exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[img('a','RIGHT')]});
 const r=bindPortableImages(x.package,[img('a','WRONG')]);
 assert.equal(r.complete,true);
 assert.equal(r.bindings[0].matchMode,'path');
 // Final package verification remains the authority and must reject wrong bytes.
 const y=importPortableCorpus({entries:[
   ...x.entries.filter(e=>e.path!=='images/a.jpg'&&e.path!=='archive-manifest.json'),
   img('a','WRONG'),
   x.entries.find(e=>e.path==='archive-manifest.json')
 ]});
 assert.equal(y.valid,false);
});

test('portable import rejects duplicate archive paths',()=>{
 const x=exportPortableCorpus({items:[{draft:eligible('a')}],imageEntries:[img('a')]});
 const y=importPortableCorpus({entries:[...x.entries,x.entries.find(e=>e.path==='images/a.jpg')]});
 assert.equal(y.valid,false);assert.equal(y.reason,'PORTABLE_CORPUS_DUPLICATE_PATH');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {BatchAnnotationQueue,stageOf} from '../core/evaluation/receipt-corpus/batch-annotation-queue.js';
import {ReceiptIntakePersistence} from '../core/evaluation/receipt-corpus/intake-persistence.js';

const draft=stage=>({caseId:'x',workflow:{stage},fields:{}});

test('batch queue supports many receipts and preserves insertion order',()=>{
 const q=new BatchAnnotationQueue({sessionId:'s'});
 q.add({caseId:'a',fileName:'a.jpg'});q.add({caseId:'b',fileName:'b.jpg'});q.add({caseId:'c',fileName:'c.jpg'});
 assert.deepEqual(q.items.map(x=>x.caseId),['a','b','c']);
 assert.equal(q.activeCaseId,'a');
});

test('batch queue rejects duplicate case ids',()=>{
 const q=new BatchAnnotationQueue();q.add({caseId:'a'});
 assert.throws(()=>q.add({caseId:'a'}),/BATCH_DUPLICATE_CASE/);
});

test('queue stages distinguish pending annotation review eligible error skipped',()=>{
 const q=new BatchAnnotationQueue({items:[
  {caseId:'p'},{caseId:'a',draft:{workflow:{stage:'annotation'}}},{caseId:'r',draft:{workflow:{stage:'review'}}},
  {caseId:'e',draft:{workflow:{stage:'eligible'}}},{caseId:'x',errorCode:'OCR_FAILED'},{caseId:'s',skipped:true}
 ]});
 assert.deepEqual(q.summary().byStage,{pending:1,annotation:1,review:1,eligible:1,error:1,skipped:1});
});

test('next previous and skip navigate without deleting work',()=>{
 const q=new BatchAnnotationQueue({items:[{caseId:'a'},{caseId:'b'},{caseId:'c'}]});
 assert.equal(q.next().caseId,'b');assert.equal(q.previous().caseId,'a');
 q.skip('a');assert.equal(q.activeCaseId,'b');assert.equal(q.get('a').skipped,true);
 assert.equal(q.items.length,3);
});

test('queue can filter review and eligible work',()=>{
 const q=new BatchAnnotationQueue({items:[
  {caseId:'a',draft:{workflow:{stage:'annotation'}}},
  {caseId:'r',draft:{workflow:{stage:'review'}}},
  {caseId:'e',draft:{workflow:{stage:'eligible'}}},
 ]});
 assert.deepEqual(q.list({stage:'review'}).map(x=>x.caseId),['r']);
 assert.deepEqual(q.list({stage:'eligible'}).map(x=>x.caseId),['e']);
});

test('queue snapshot restores active item and drafts',()=>{
 const q=new BatchAnnotationQueue({sessionId:'s',items:[{caseId:'a'},{caseId:'b'}]});
 q.attachDraft('b',{caseId:'b',workflow:{stage:'review'},fields:{total:{value:100}}});q.select('b');
 const restored=BatchAnnotationQueue.fromSnapshot(q.snapshot());
 assert.equal(restored.activeCaseId,'b');assert.equal(restored.get('b').draft.fields.total.value,100);
});

test('persistence saves metadata and draft but never raw image bytes',()=>{
 const mem=new Map(),storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 const p=new ReceiptIntakePersistence({storage,key:'x'});
 p.save({sessionId:'s',activeCaseId:'a',items:[{caseId:'a',fileName:'a.jpg',fileSize:123,imageRef:'images/a.jpg',draft:{workflow:{stage:'annotation'}},rawImage:'data:image/jpeg;base64,SECRET'}]});
 const raw=mem.get('x');
 assert.equal(raw.includes('SECRET'),false);
 assert.equal(raw.includes('data:image'),false);
 const loaded=p.load();assert.equal(loaded.items[0].fileName,'a.jpg');
});

test('persistence clear removes resumable session',()=>{
 const mem=new Map(),storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 const p=new ReceiptIntakePersistence({storage,key:'x'});p.save({sessionId:'s',items:[]});assert.ok(p.load());p.clear();assert.equal(p.load(),null);
});

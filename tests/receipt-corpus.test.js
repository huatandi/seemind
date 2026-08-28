import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGroundTruth} from '../core/evaluation/receipt-corpus/ground-truth-schema.js';
import {validateReceiptCorpusCase,validateReceiptCorpus} from '../core/evaluation/receipt-corpus/corpus-validator.js';
import {buildReceiptCorpusManifest,verifyReceiptCorpusManifest} from '../core/evaluation/receipt-corpus/corpus-manifest.js';
import {scanReceiptTextForSensitiveData,redactReceiptText} from '../core/evaluation/receipt-corpus/pii-redaction.js';
import {corpusManifestToBenchmarkDataset} from '../core/evaluation/receipt-corpus/benchmark-adapter.js';

function good(id='r1'){
 return normalizeGroundTruth({
  caseId:id,imageRef:`images/${id}.redacted.jpg`,receiptType:'supermarket',difficulty:'medium',
  fields:{merchant:'EL FLORIDO',date:'2026-08-20',subtotal:64751,tax:887,discount:null,total:65638,cash:70000,change:4362},
  annotation:{status:'reviewed',annotatorId:'a1',reviewedBy:'r1',reviewedAt:'2026-08-25T00:00:00Z'},
  provenance:{source:'user-provided',consentConfirmed:true,redacted:true}
 });
}

test('ground truth normalization uses centavo-safe field contract',()=>{
 const x=good(); assert.equal(x.fields.total.value,65638);assert.equal(x.fields.discount.status,'unresolved');
});

test('strict corpus validation requires reviewed ground truth',()=>{
 const x=good();x.annotation.status='draft';x.annotation.reviewedBy=null;
 const r=validateReceiptCorpusCase(x,{strict:true});
 assert.equal(r.valid,false);assert.ok(r.errors.includes('REVIEW_REQUIRED_FOR_BENCHMARK'));
});

test('corpus validation warns on arithmetic ground truth conflict without rewriting truth',()=>{
 const x=good();x.fields.total.value=99999;
 const r=validateReceiptCorpusCase(x,{strict:false});
 assert.ok(r.warnings.includes('ARITHMETIC_GROUND_TRUTH_CONFLICT'));
 assert.equal(x.fields.total.value,99999);
});

test('corpus catches duplicate case IDs',()=>{
 const r=validateReceiptCorpus([good('a'),good('a')],{strict:true});
 assert.equal(r.valid,false);assert.ok(r.results[1].errors.includes('DUPLICATE_CASE_ID'));
});

test('manifest has deterministic content hash and detects tampering',()=>{
 const m=buildReceiptCorpusManifest({datasetId:'mx',version:'1',cases:[good('a'),good('b')]});
 assert.equal(m.validation.valid,true);assert.match(m.contentHash,/^sha256:/);
 assert.equal(verifyReceiptCorpusManifest(m).valid,true);
 m.cases[0].fields.total.value=1;
 assert.equal(verifyReceiptCorpusManifest(m).hashMatches,false);
});

test('sensitive text scanner detects RFC email and valid payment card',()=>{
 const text='RFC ABC010101AA1 correo a@b.com tarjeta 4111 1111 1111 1111';
 const f=scanReceiptTextForSensitiveData(text);
 assert.ok(f.some(x=>x.type==='rfc'));assert.ok(f.some(x=>x.type==='email'));assert.ok(f.some(x=>x.type==='payment_card'));
});

test('text redaction removes detected sensitive values',()=>{
 const r=redactReceiptText('RFC ABC010101AA1 correo a@b.com');
 assert.equal(r.count,2);assert.equal(r.text.includes('ABC010101AA1'),false);assert.equal(r.text.includes('a@b.com'),false);
});

test('validated corpus manifest converts directly into OCR benchmark dataset',()=>{
 const m=buildReceiptCorpusManifest({datasetId:'mx',version:'1.0',cases:[good()]});
 const ds=corpusManifestToBenchmarkDataset(m);
 assert.equal(ds.summary().caseCount,1);
 assert.equal(ds.list()[0].expected.total.value,65638);
 assert.equal(ds.list()[0].metadata.contentHash,m.contentHash);
});

test('invalid corpus cannot silently enter benchmark',()=>{
 const x=good();x.annotation.status='draft';
 const m=buildReceiptCorpusManifest({cases:[x]});
 assert.equal(m.validation.valid,false);
 assert.throws(()=>corpusManifestToBenchmarkDataset(m),/RECEIPT_CORPUS_INVALID/);
});

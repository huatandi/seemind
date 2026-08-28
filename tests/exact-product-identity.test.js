import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExactProductIdentity} from '../core/entity/exact-product-identity.js';

test('valid GTIN plus package text creates exact product candidate',()=>{
 const x=buildExactProductIdentity({
  barcodeObservation:{items:[{rawValue:'7501055300075',format:'ean_13'}]},
  extractedText:'MARCA: ACME MODELO: ZX-500 500 ml SABOR: LIMON'
 });
 assert.equal(x.identity.barcode,'7501055300075');
 assert.equal(x.identity.brand,'ACME');
 assert.equal(x.identity.model,'ZX-500');
 assert.equal(x.identity.size,'500 ml');
 assert.equal(x.status,'exact_candidate');
 assert.match(x.searchKey,/7501055300075/);
});

test('invalid GTIN is not promoted as exact identity evidence',()=>{
 const x=buildExactProductIdentity({barcodeObservation:{items:[{rawValue:'7501055300076',format:'ean_13'}]}});
 assert.equal(x.identity.barcode,null);
 assert.equal(x.status,'partial');
});

test('vision alone does not assert exact package variant',()=>{
 const x=buildExactProductIdentity({visionIdentities:[{type:'brand',label:'Coca-Cola',confidence:.95},{type:'identity',label:'soft drink',confidence:.98}]});
 assert.equal(x.exact,false);
 assert.equal(x.policy.visionAloneCannotAssertExactVariant,true);
});

test('multiple valid product barcodes create conflict rather than silent selection',()=>{
 const x=buildExactProductIdentity({barcodeObservation:{items:[
  {rawValue:'7501055300075',format:'ean_13'},
  {rawValue:'4006381333931',format:'ean_13'}
 ]}});
 assert.equal(x.identity.barcode,null);
 assert.equal(x.status,'conflicted');
 assert.ok(x.conflicts.some(c=>c.field==='barcode'));
});

test('model plus brand and size can form exact candidate without barcode but remains lower confidence',()=>{
 const x=buildExactProductIdentity({extractedText:'MARCA: ACME\nMODELO: ZX-500\nCONT. NET. 500 ml'});
 assert.equal(x.exact,true);
 assert.ok(x.confidence<.99);
 assert.ok(x.missing.includes('barcode'));
});

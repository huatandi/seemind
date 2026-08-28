import test from 'node:test';
import assert from 'node:assert/strict';
import {compareGroundedOffers,matchOfferIdentity} from '../core/search/grounded-price-comparison.js';
import {planSearch} from '../core/search/search-planner.js';
import {searchResultsToEvidence} from '../core/search/search-evidence.js';

test('price comparison is blocked until exact identity is grounded',()=>{
 const x=compareGroundedOffers({identity:{status:'partial',identity:{brand:'ACME'}},offers:[{price:10}]});
 assert.equal(x.status,'blocked_identity');
});

test('same brand but wrong size is rejected as a different product',()=>{
 const identity={status:'exact_candidate',exact:true,identity:{barcode:'7501055300075',brand:'ACME',model:'ZX-500',size:'500 ml'}};
 const x=compareGroundedOffers({identity,offers:[
  {id:'right',price:100,shipping:10,availability:'in_stock',product:{barcode:'7501055300075',brand:'ACME',model:'ZX-500',size:'500 ml'}},
  {id:'wrong',price:70,availability:'in_stock',product:{brand:'ACME',model:'ZX-500',size:'1 L'}}
 ]});
 assert.equal(x.best.id,'right');
 assert.ok(x.rejected.some(o=>o.id==='wrong'));
});

test('out of stock headline price cannot win',()=>{
 const identity={status:'exact_candidate',exact:true,identity:{barcode:'7501055300075'}};
 const x=compareGroundedOffers({identity,offers:[
  {id:'cheap',price:60,availability:'out_of_stock',product:{barcode:'7501055300075'}},
  {id:'buyable',price:75,shipping:5,availability:'in_stock',product:{barcode:'7501055300075'}}
 ]});
 assert.equal(x.best.id,'buyable');assert.equal(x.best.totalCost,80);
});

test('online total cost includes known shipping and flags unknown shipping',()=>{
 const identity={status:'exact_candidate',exact:true,identity:{barcode:'7501055300075'}};
 const x=compareGroundedOffers({identity,offers:[
  {id:'a',price:90,shipping:20,channel:'online',availability:'in_stock',product:{barcode:'7501055300075'}},
  {id:'b',price:100,channel:'online',availability:'in_stock',product:{barcode:'7501055300075'}}
 ]});
 assert.equal(x.best.id,'b');assert.ok(x.warnings.includes('ONLINE_SHIPPING_UNKNOWN'));
});

test('search planner prefers exact product search key over fuzzy entity name',()=>{
 const p=planSearch({task:{webSearchRequired:true,userIntent:'current price'},freshness:{required:true},identity:{required:false,ok:true},exactProductIdentity:{status:'exact_candidate',searchKey:'7501055300075 ACME ZX-500 500 ml'},entityResolution:{primary:{canonicalName:'ACME product'}}});
 assert.match(p.query,/7501055300075 ACME ZX-500 500 ml current price/);
});

test('search evidence preserves structured offer fields for grounded comparison',()=>{
 const [e]=searchResultsToEvidence([{title:'Store',url:'https://shop.example/p',price:99,currency:'MXN',shipping:10,availability:'in_stock',product:{barcode:'7501055300075'}}],{task:{type:'price_search'}});
 assert.equal(e.price,99);assert.equal(e.product.barcode,'7501055300075');
});

test('barcode exact match dominates weak textual omissions without allowing contradiction',()=>{
 const x=matchOfferIdentity({barcode:'7501055300075',brand:'ACME',size:'500 ml'},{barcode:'7501055300075',brand:'ACME'});
 assert.equal(x.ok,true);
});

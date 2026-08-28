import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEntities,identityGate,identityRequirementForTask} from '../core/entity/entity-resolver.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';

const ev=(value,confidence=.9)=>({id:'merchant-ev',field:'merchant',value,confidence,sourceText:value,rule:'MERCHANT'});

test('receipt merchant can become a merchant entity without inventing brand/model',()=>{
  const r=resolveEntities({receipt:{merchant:ev('Walmart',.94)}});
  assert.equal(r.primary.canonicalName,'Walmart');
  assert.equal(r.primary.category,'merchant');
  assert.equal(r.primary.model,null);
  assert.ok(r.identityConfidence>=.9);
});

test('generic merchant labels do not become fake identities',()=>{
  const r=resolveEntities({receipt:{merchant:ev('TIENDA',.99)}});
  assert.equal(r.primary,null);
  assert.equal(r.requiresClarification,true);
});

test('competing high-confidence candidates lower identity confidence and require clarification',()=>{
  const r=resolveEntities({candidates:[
    {canonicalName:'Kia Sportage',category:'vehicle',brand:'Kia',model:'Sportage',confidence:.86},
    {canonicalName:'Kia Sorento',category:'vehicle',brand:'Kia',model:'Sorento',confidence:.82},
  ]});
  assert.equal(r.requiresClarification,true);
  assert.ok(r.primary.confidence<.75);
  assert.ok(r.conflicts.some(x=>x.startsWith('competing_identity:')));
});

test('price/manual/repair tasks require stronger identity than general questions',()=>{
  assert.equal(identityRequirementForTask({type:'price_search'}).required,true);
  assert.equal(identityRequirementForTask({type:'general_qa'}).required,false);
  const weak={primary:{confidence:.7,conflicts:[],requiresClarification:true}};
  assert.equal(identityGate({type:'troubleshooting'},weak).ok,false);
});

test('compiled task package carries canonical entity and identity gate',()=>{
  const observation={entities:[{canonicalName:'Nespresso Essenza Mini',category:'product',brand:'Nespresso',model:'Essenza Mini',confidence:.94,evidenceRefs:['vision-1']}],confidence:{identity:.94},limitations:[]};
  const p=compileTaskPackage({task:{type:'troubleshooting',userIntent:'这个咖啡机怎么修？'},observation,userIntent:'这个咖啡机怎么修？'});
  assert.equal(p.schemaVersion,2);
  assert.equal(p.entities[0].model,'Essenza Mini');
  assert.equal(p.identity.ok,true);
  assert.equal(p.identity.context.status,'confirmed');
});

test('identity-dependent package explicitly blocks assumptions when identity is missing',()=>{
  const p=compileTaskPackage({task:{type:'price_search',userIntent:'这个现在多少钱？'},observation:{entities:[],confidence:{identity:0},limitations:[]}});
  assert.equal(p.identity.ok,false);
  assert.equal(p.identity.reason,'identity_missing');
  assert.equal(p.identity.context.status,'unresolved');
});

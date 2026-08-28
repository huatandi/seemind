import test from 'node:test';
import assert from 'node:assert/strict';
import {PilotLabController} from '../core/perception/lab/pilot-lab-controller.js';

function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}

test('pilot lab controller persists collected cases',()=>{
 const s=storage(),a=new PilotLabController({storage:s});
 a.addCase({modality:'vision',assetRef:'cup.jpg',category:'everyday_objects',expectedLabels:['cup']});a.save();
 const b=new PilotLabController({storage:s});
 assert.equal(b.dashboard().cases.length,1);assert.equal(b.dashboard().truth.usable,true);
});

test('pilot lab import/export round trips',()=>{
 const a=new PilotLabController({storage:storage()});
 a.addCase({modality:'voice',assetRef:'voice.wav',category:'plain_intent',expectedText:'what is this'});
 const json=a.exportJson(),b=new PilotLabController({storage:storage()});b.importJson(json);
 assert.equal(b.dashboard().cases[0].expected.text,'what is this');
});

test('pilot lab dashboard exposes blocking ground truth',()=>{
 const a=new PilotLabController({storage:storage()});
 a.addCase({modality:'vision',assetRef:'unknown.jpg',category:'everyday_objects',expectedLabels:[]});
 assert.equal(a.dashboard().truth.usable,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerceptionBudget} from '../core/perception/perception-budget.js';
import {rescoreSpeechAlternatives} from '../core/voice/voice-context-rescorer.js';

test('universal vision budget does not reserve OCR work on the critical path',()=>{
 const b=createPerceptionBudget({tier:'low_power'},{primaryRoute:'universal_vision'});
 assert.equal(b.ocrPriority,'deferred');
 assert.equal(b.ocrCandidates,0);
 assert.equal(b.ocrEngines,0);
 assert.equal(b.visionPriority,'high');
});

test('context cannot overturn a materially stronger acoustic speech hypothesis',()=>{
 const observation={observations:[{kind:'ocr',rawText:'banorte banorte banorte'}]};
 const out=rescoreSpeechAlternatives({
   alternatives:[
    {text:'BBVA',confidence:.92},
    {text:'Banorte',confidence:.48},
   ],
   observation,
 });
 assert.equal(out.primary.text,'BBVA');
});

test('close ASR alternatives are marked uncertain instead of silently committed',()=>{
 const out=rescoreSpeechAlternatives({
   alternatives:[
    {text:'modelo A15',confidence:.62},
    {text:'modelo A50',confidence:.60},
   ],
   observation:null,
 });
 assert.equal(out.quality.shouldClarify,true);
 assert.ok(out.quality.reasons.includes('ALTERNATIVES_TOO_CLOSE'));
});

test('low acoustic speech is marked uncertain even if context likes it',()=>{
 const observation={observations:[{kind:'ocr',rawText:'Sportage'}]};
 const out=rescoreSpeechAlternatives({
   alternatives:[{text:'Sportage',confidence:.35}],
   observation,
 });
 assert.equal(out.quality.shouldClarify,true);
 assert.ok(out.quality.reasons.includes('LOW_ACOUSTIC_CONFIDENCE'));
});

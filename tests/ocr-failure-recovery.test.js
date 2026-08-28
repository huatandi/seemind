import test from 'node:test';
import assert from 'node:assert/strict';
import {planOcrFailureRecovery} from '../core/ocr/ocr-failure-recovery.js';

function ensemble({score=90,critical=1,conflicts=0,text='TOTAL 100.00',engines=1}={}){
 return {selected:{scoring:{score,criticalCompleteness:critical,conflictedChecks:conflicts},normalization:{normalizedText:text}},engines:Array.from({length:engines},(_,i)=>({status:'ok',engineId:`e${i}`}))};
}

test('difficult low-contrast OCR prefers bounded preprocessing before escalation',()=>{
 const x=planOcrFailureRecovery({quality:{flags:['low_contrast'],score:.4},ensemble:ensemble({score:68,critical:.5}),attempts:0});
 assert.equal(x.shouldEscalate,false);
 assert.equal(x.nextAction.type,'ALTERNATE_PREPROCESS');
 assert.ok(x.reasons.includes('CRITICAL_FIELDS_MISSING'));
});

test('blur gives concrete recapture guidance and never authorizes guessing',()=>{
 const x=planOcrFailureRecovery({quality:{flags:['blurry_or_low_detail']},ensemble:ensemble({score:55,critical:0,text:''})});
 assert.ok(x.actions.some(a=>a.type==='RECAPTURE'&&/靠近|稳住/.test(a.instruction)));
 assert.equal(x.invariants.neverGuessMissingText,true);
});

test('semantic arithmetic conflict requests alternate verification rather than rewriting fields',()=>{
 const x=planOcrFailureRecovery({quality:{flags:[]},ensemble:ensemble({score:76,critical:1,conflicts:1})});
 assert.ok(x.actions.some(a=>a.type==='VERIFY_WITH_ALTERNATE_ENGINE'));
 assert.equal(x.invariants.neverOverwriteResolvedFieldFromRecovery,true);
});

test('bounded repeated OCR failure escalates only the minimum necessary text region',()=>{
 const x=planOcrFailureRecovery({quality:{flags:['blurry_or_low_detail']},ensemble:ensemble({score:40,critical:0,text:''}),attempts:2});
 assert.equal(x.shouldEscalate,true);
 assert.ok(x.actions.some(a=>a.type==='TEACHER'&&a.sendPolicy==='minimum_necessary_text_region'));
});

test('strong OCR needs no recovery',()=>{
 const x=planOcrFailureRecovery({quality:{flags:[],score:.9},ensemble:ensemble({score:94,critical:1,conflicts:0,text:'FECHA 20/08/2026 TOTAL $656.38'})});
 assert.equal(x.needed,false);
 assert.equal(x.shouldEscalate,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runMultiPassOcr} from '../core/ocr/multi-pass-ocr.js';

const candidate=id=>({blob:new Blob([id]),planId:id});

test('strong OCR first pass stops before redundant recovery candidates',async()=>{
 let calls=0;
 const engine={recognize:async()=>{calls++;return {engineId:'fast',confidence:.99,text:'TIENDA\n2026-08-27\nTOTAL $108.00',blocks:[]}}};
 const out=await runMultiPassOcr({candidates:[candidate('base'),candidate('contrast'),candidate('dark')],ocrEngine:engine,maxPasses:3,earlyStopScore:70});
 assert.equal(calls,1);
 assert.equal(out.passes.length,1);
});

test('web capture does not mistake UI language for document OCR language',()=>{
 const source=fs.readFileSync('apps/web/src/main.js','utf8');
 assert.match(source,/observeImage\(f,\{ocrEngines,userQuestion:captureQuestion,ocrLanguage:'auto'/);
 assert.doesNotMatch(source,/ocrLanguage:currentGlobalContext\.language\?\?navigator\.language/);
});

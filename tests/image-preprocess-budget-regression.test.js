import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeImageQuality,resolveQualitySampleStep} from '../features/capture/image-quality.js';
import {applyEnhancementToPixelsInPlace,applyLightSharpenPixelsInPlace} from '../features/capture/image-preprocessor.js';

const rgba=(w,h,v=120)=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4){d[i]=v;d[i+1]=v;d[i+2]=v;d[i+3]=255}return d};

test('quality analysis honors an already-aborted signal',()=>{const c=new AbortController();c.abort();assert.throws(()=>analyzeImageQuality(rgba(32,32),32,32,{signal:c.signal}),e=>e?.code==='IMAGE_PREPROCESS_ABORTED');});

test('quality analysis honors an exhausted deadline',()=>{assert.throws(()=>analyzeImageQuality(rgba(32,32),32,32,{deadlineAt:-1}),e=>e?.code==='IMAGE_PREPROCESS_BUDGET_EXHAUSTED');});

test('grayscale hot path preserves alpha',()=>{const d=new Uint8ClampedArray([10,20,30,77]);applyEnhancementToPixelsInPlace(d,{grayscale:true,contrast:1,brightness:0,gamma:1});assert.equal(d[3],77);});

test('grayscale integer luminance remains perceptually close to standard coefficients',()=>{const d=new Uint8ClampedArray([200,100,50,255]);applyEnhancementToPixelsInPlace(d,{grayscale:true,contrast:1,brightness:0,gamma:1});const expected=Math.round(.299*200+.587*100+.114*50);assert.ok(Math.abs(d[0]-expected)<=1);});

test('pixel enhancement refuses work after preprocessing deadline',()=>{const d=rgba(1024,256);assert.throws(()=>applyEnhancementToPixelsInPlace(d,{grayscale:true},null,-1),e=>e?.code==='IMAGE_PREPROCESS_BUDGET_EXHAUSTED');});

test('sharpen refuses work after preprocessing deadline',()=>{const d=rgba(64,64);assert.throws(()=>applyLightSharpenPixelsInPlace(d,64,64,.1,null,-1),e=>e?.code==='IMAGE_PREPROCESS_BUDGET_EXHAUSTED');});

test('large quality frames use bounded sampling',()=>{assert.ok(resolveQualitySampleStep(8000,6000,{maxSamples:120000})>=20);});

test('small quality frames retain baseline sampling density',()=>{assert.equal(resolveQualitySampleStep(640,480,{maxSamples:120000}),4);});

test('preprocessor exposes total preprocessing timing',()=>{const src=fs.readFileSync(new URL('../features/capture/image-preprocessor.js',import.meta.url),'utf8');assert.match(src,/preprocessMs:roundMs/);});

test('preprocessor exposes whether its soft budget was consumed',()=>{const src=fs.readFileSync(new URL('../features/capture/image-preprocessor.js',import.meta.url),'utf8');assert.match(src,/budgetExhausted:/);});

test('local student passes remaining perception budget into preprocessing',()=>{const src=fs.readFileSync(new URL('../providers/local/local-student.js',import.meta.url),'utf8');assert.match(src,/totalBudgetMs:Math\.max\(250,perceptionBudget\.totalLocalMs-/);});

test('recovery candidates stop when preprocessing budget is consumed',()=>{const src=fs.readFileSync(new URL('../features/capture/image-preprocessor.js',import.meta.url),'utf8');assert.match(src,/candidates\.length&&remainingBudget\(deadlineAt\).*<=0\)break/);});

test('local grayscale enhancement uses LUT instead of per-pixel power transform',()=>{const src=fs.readFileSync(new URL('../features/capture/image-preprocessor.js',import.meta.url),'utf8');assert.match(src,/v=lut\[y\]/);assert.doesNotMatch(src,/grayscale\).*transform\(y/);});

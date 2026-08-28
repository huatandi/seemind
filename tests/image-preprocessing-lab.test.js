import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeImageQuality,chooseEnhancementPlan,candidateEnhancementPlans} from '../features/capture/image-quality.js';
import {applyEnhancementToPixels} from '../features/capture/image-preprocessor.js';

function solid(width,height,value){
  const d=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=value;d[i+3]=255}
  return {data:d,width,height};
}
function stripes(width,height,a,b){
  const d=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=(x%2)?a:b,i=(y*width+x)*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;
  }
  return {data:d,width,height};
}

test('quality analyzer detects underexposure',()=>{
  const x=solid(20,20,30);const q=analyzeImageQuality(x,x.width,x.height,{sampleStep:1});
  assert.ok(q.flags.includes('underexposed'));
  assert.ok(q.flags.includes('dark_clipping'));
  const p=chooseEnhancementPlan(q);
  assert.equal(p.id,'adaptive-dark');
  assert.ok(p.brightness>0);
});

test('quality analyzer detects overexposure',()=>{
  const x=solid(20,20,245);const q=analyzeImageQuality(x,x.width,x.height,{sampleStep:1});
  assert.ok(q.flags.includes('overexposed'));
  assert.ok(q.flags.includes('highlight_clipping'));
  const p=chooseEnhancementPlan(q);
  assert.equal(p.id,'adaptive-bright');
  assert.ok(p.brightness<0);
});

test('flat image is low contrast while striped text-like image has stronger edge score',()=>{
  const flat=solid(24,24,150);
  const edge=stripes(24,24,40,230);
  const q1=analyzeImageQuality(flat,24,24,{sampleStep:1});
  const q2=analyzeImageQuality(edge,24,24,{sampleStep:1});
  assert.ok(q1.flags.includes('low_contrast'));
  assert.ok(q2.sharpness>q1.sharpness);
  assert.ok(q2.contrast>q1.contrast);
});

test('candidate plan generation is bounded and includes safe baseline',()=>{
  const x=solid(20,20,120);const q=analyzeImageQuality(x,20,20,{sampleStep:1});
  const plans=candidateEnhancementPlans(q);
  assert.ok(plans.length>=2&&plans.length<=4);
  assert.ok(plans.some(x=>x.id==='gentle-gray'));
  assert.equal(new Set(plans.map(x=>x.id)).size,plans.length);
});

test('pixel enhancement converts to grayscale without modifying caller buffer',()=>{
  const src=new Uint8ClampedArray([255,0,0,255,0,255,0,255]);
  const out=applyEnhancementToPixels(src,{grayscale:true,contrast:1,brightness:0,gamma:1});
  assert.notEqual(out,src);
  assert.deepEqual([...src],[255,0,0,255,0,255,0,255]);
  assert.equal(out[0],out[1]);assert.equal(out[1],out[2]);
  assert.equal(out[4],out[5]);assert.equal(out[5],out[6]);
});

test('dark recovery raises midtone brightness conservatively',()=>{
  const src=new Uint8ClampedArray([40,40,40,255]);
  const out=applyEnhancementToPixels(src,{grayscale:true,contrast:1.2,brightness:28,gamma:.85});
  assert.ok(out[0]>40);
  assert.ok(out[0]<=255);
});

test('enhancement never changes alpha channel',()=>{
  const src=new Uint8ClampedArray([20,40,60,77,200,220,240,123]);
  const out=applyEnhancementToPixels(src,{grayscale:true,contrast:1.5,brightness:15,gamma:.9});
  assert.equal(out[3],77);
  assert.equal(out[7],123);
});

test('in-place enhancement avoids a second full-frame allocation while preserving alpha',async()=>{
 const {applyEnhancementToPixelsInPlace}=await import('../features/capture/image-preprocessor.js');
 const src=new Uint8ClampedArray([20,40,60,77,200,220,240,123]);
 const out=applyEnhancementToPixelsInPlace(src,{grayscale:true,contrast:1.1,brightness:4,gamma:1});
 assert.equal(out,src); assert.equal(out[3],77); assert.equal(out[7],123);
});

test('row-buffer sharpen preserves borders and alpha without a full-frame source clone',async()=>{
 const {applyLightSharpenPixelsInPlace}=await import('../features/capture/image-preprocessor.js');
 const w=5,h=5,d=new Uint8ClampedArray(w*h*4).fill(255);
 for(let i=3;i<d.length;i+=4)d[i]=91;
 const center=(2*w+2)*4; d[center]=d[center+1]=d[center+2]=40;
 const before=[...d.slice(0,w*4)];
 const out=applyLightSharpenPixelsInPlace(d,w,h,.2);
 assert.equal(out,d); assert.deepEqual([...d.slice(0,w*4)],before);
 for(let i=3;i<d.length;i+=4)assert.equal(d[i],91);
 assert.ok(d[center]<40);
});

test('LUT enhancement keeps deterministic grayscale and color transforms',async()=>{
 const {applyEnhancementToPixelsInPlace}=await import('../features/capture/image-preprocessor.js');
 const gray=new Uint8ClampedArray([255,0,0,7]);
 applyEnhancementToPixelsInPlace(gray,{grayscale:true,contrast:1,brightness:0,gamma:1});
 assert.deepEqual([...gray],[76,76,76,7]);
 const color=new Uint8ClampedArray([10,120,240,33]);
 applyEnhancementToPixelsInPlace(color,{grayscale:false,contrast:1,brightness:0,gamma:1});
 assert.deepEqual([...color],[10,120,240,33]);
});

test('common gamma=1 enhancement path preserves exact pixel values',async()=>{
 const {applyEnhancementToPixelsInPlace}=await import('../features/capture/image-preprocessor.js');
 const d=new Uint8ClampedArray([0,64,128,1,192,254,255,2]);
 const before=[...d]; applyEnhancementToPixelsInPlace(d,{grayscale:false,contrast:1,brightness:0,gamma:1});
 assert.deepEqual([...d],before);
});

test('row-buffer sharpen handles tall images without corrupting later rows',async()=>{
 const {applyLightSharpenPixelsInPlace}=await import('../features/capture/image-preprocessor.js');
 const w=4,h=70,d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=(y+x*17)%256;d[i+3]=200;}
 applyLightSharpenPixelsInPlace(d,w,h,.1);
 for(let i=3;i<d.length;i+=4)assert.equal(d[i],200);
 assert.equal(d.length,w*h*4);
});

test('quality sampling automatically caps work for large OCR frames',async()=>{
 const {resolveQualitySampleStep}=await import('../features/capture/image-quality.js');
 assert.equal(resolveQualitySampleStep(800,600,{}),4);
 assert.ok(resolveQualitySampleStep(4000,3000,{})>=10);
 assert.equal(resolveQualitySampleStep(4000,3000,{sampleStep:2}),2);
});

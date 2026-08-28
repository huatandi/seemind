import test from 'node:test';
import assert from 'node:assert/strict';
import {preprocessImageCandidates} from '../features/capture/image-preprocessor.js';

function installMocks(){
 const prev={document:globalThis.document,ImageData:globalThis.ImageData};
 const ctx={
  drawImage(){},putImageData(){},
  getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=90;data[i+1]=95;data[i+2]=100;data[i+3]=255}return {data,width:w,height:h}}
 };
 globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height}};
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return ctx},toBlob(cb){cb(new Blob([new Uint8Array(32)],{type:'image/png'}))}}}};
 return ()=>{if(prev.document===undefined)delete globalThis.document;else globalThis.document=prev.document;if(prev.ImageData===undefined)delete globalThis.ImageData;else globalThis.ImageData=prev.ImageData};
}

test('multiple OCR candidates decode the original image only once',async()=>{
 const restore=installMocks();let decodes=0,closed=0;
 try{
  const file=new Blob([new Uint8Array(20)],{type:'image/jpeg'});
  const out=await preprocessImageCandidates(file,{maxCandidates:3,bitmapFactory:async()=>{decodes++;return {width:1200,height:900,close(){closed++}}}});
  assert.equal(decodes,1);
  assert.equal(closed,1);
  assert.ok(out.candidates.length>=1);
  assert.equal(out.sourceReuse.decodeCount,1);
  assert.equal(out.sourceReuse.policy,'DECODE_ONCE_DERIVE_MANY');
 }finally{restore()}
});

test('shared prepared source lets OCR derive candidates with zero additional decode',async()=>{
 const restore=installMocks();let closed=0;
 try{
  const file=new Blob([new Uint8Array(20)],{type:'image/jpeg'});
  const prepared={width:1200,height:900,drawable:{width:1200,height:900},close(){closed++}};
  const out=await preprocessImageCandidates(file,{maxCandidates:2,preparedSource:prepared,bitmapFactory:async()=>{throw new Error('must not decode')}});
  assert.equal(out.sourceReuse.sharedDecode,true);
  assert.equal(out.sourceReuse.decodeCount,0);
  assert.equal(closed,0,'borrowed source lifetime stays with owner');
  assert.ok(out.candidates.every(x=>x.operations.sharedDecode));
 }finally{restore()}
});

test('candidate derivation is bounded to four to protect mobile memory',async()=>{
 const restore=installMocks();
 try{
  const file=new Blob([new Uint8Array(20)],{type:'image/jpeg'});
  const plans=Array.from({length:8},(_,i)=>({id:`p${i}`,grayscale:true,contrast:1,brightness:0,gamma:1,sharpen:0}));
  const out=await preprocessImageCandidates(file,{maxCandidates:8,plans,bitmapFactory:async()=>({width:500,height:500,close(){}})});
  assert.equal(out.candidates.length,4);
 }finally{restore()}
});

test('released OCR candidate is idempotent and cannot encode an empty canvas later',async()=>{
 const restore=installMocks();
 try{
  const out=await preprocessImageCandidates(new Blob([new Uint8Array(2)]),{maxCandidates:1,plans:[{id:'x',grayscale:true,contrast:1,brightness:0,gamma:1,sharpen:0}],bitmapFactory:async()=>({width:20,height:20,close(){}})});
  const c=out.candidates[0]; c.release(); c.release();
  await assert.rejects(()=>c.getBlob(),e=>e.code==='IMAGE_CANDIDATE_RELEASED');
 }finally{restore()}
});

test('aborted preprocessing releases source even before candidate completion',async()=>{
 const restore=installMocks();let closed=0;const ac=new AbortController();ac.abort();
 try{
  await assert.rejects(()=>preprocessImageCandidates(new Blob([new Uint8Array(2)]),{signal:ac.signal,bitmapFactory:async()=>({width:20,height:20,close(){closed++}})}),e=>e.code==='IMAGE_PREPROCESS_ABORTED');
  assert.equal(closed,0,'pre-aborted work never starts a decode');
 }finally{restore()}
});

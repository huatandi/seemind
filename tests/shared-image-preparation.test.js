import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreparedImageSource} from '../features/capture/prepared-image-source.js';
import {runPerceptionFastTriage} from '../core/perception/perception-fast-triage.js';
import {prepareVisionAttachment} from '../features/capture/vision-attachment.js';
import {observeImage} from '../providers/local/local-student.js';

function installCanvasMocks(){
  const previous={document:globalThis.document,FileReader:globalThis.FileReader,createImageBitmap:globalThis.createImageBitmap};
  const ctx={
    drawImage(){},
    getImageData(x,y,w,h){
      const data=new Uint8ClampedArray(w*h*4);
      for(let i=0;i<data.length;i+=4){data[i]=80;data[i+1]=130;data[i+2]=170;data[i+3]=255}
      return {data,width:w,height:h};
    },
  };
  globalThis.document={createElement(tag){
    if(tag!=='canvas')throw new Error('unexpected element');
    return {width:0,height:0,getContext(){return ctx},toBlob(cb){cb(new Blob([new Uint8Array(256)],{type:'image/jpeg'}))}};
  }};
  globalThis.FileReader=class{
    readAsDataURL(blob){this.result='data:image/jpeg;base64,'+'A'.repeat(16);queueMicrotask(()=>this.onload?.())}
  };
  return ()=>{
    if(previous.document===undefined)delete globalThis.document;else globalThis.document=previous.document;
    if(previous.FileReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=previous.FileReader;
    if(previous.createImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previous.createImageBitmap;
  };
}

test('one prepared decode can feed triage and teacher attachment without another createImageBitmap',async()=>{
  const restore=installCanvasMocks();
  let decodes=0,closed=0;
  try{
    const file=new Blob([new Uint8Array(100)],{type:'image/jpeg'});file.name='photo.jpg';
    const source=await createPreparedImageSource(file,{bitmapFactory:async()=>{decodes++;return {width:1200,height:900,close(){closed++}}}});
    globalThis.createImageBitmap=async()=>{throw new Error('duplicate decode should not happen')};
    const triage=await runPerceptionFastTriage(file,{preparedSource:source});
    const attachment=await prepareVisionAttachment(file,{preparedSource:source});
    assert.equal(decodes,1);
    assert.equal(closed,0,'shared source owner controls lifetime');
    assert.equal(triage.visual.width,640);
    assert.equal(attachment.width,1200);
    source.close();source.close();
    assert.equal(closed,1,'close is idempotent');
  }finally{restore()}
});

test('observeImage signals shared source consumed immediately after fast triage, before deep pipeline completion',async()=>{
  const restore=installCanvasMocks();
  try{
    const file=new Blob([new Uint8Array(100)],{type:'image/jpeg'});file.name='photo.jpg';
    const source={width:800,height:600,drawable:{width:800,height:600},close(){}};
    let consumed=false,firstUseful=false;
    const obs=await observeImage(file,{
      preparedSource:source,
      onPreparedSourceConsumed:()=>{consumed=true},
      onFirstUseful:()=>{firstUseful=true},
      visualProviders:[],
      deviceProfile:{tier:'balanced',memoryGb:8,cpuCores:8,gpu:false,mobile:true},
    });
    assert.equal(consumed,true);
    assert.equal(firstUseful,true);
    assert.equal(obs.observations.find(x=>x.kind==='image_source_reuse')?.sharedDecode,true);
  }finally{restore()}
});

test('prepared image decode is bounded and late bitmap is released after timeout',async()=>{
  let closed=0;
  const lateBitmap={width:100,height:100,close(){closed++}};
  const pending=new Promise(resolve=>setTimeout(()=>resolve(lateBitmap),300));
  await assert.rejects(
    createPreparedImageSource(new Blob([new Uint8Array(8)]),{bitmapFactory:()=>pending,timeoutMs:250}),
    /IMAGE_DECODE_TIMEOUT/
  );
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(closed,1);
});

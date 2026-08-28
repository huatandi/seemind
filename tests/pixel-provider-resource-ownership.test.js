import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelColorStateProvider} from '../providers/local/vision/pixel-color-state-provider.js';

function installCanvas(){
  const previous=globalThis.document;
  globalThis.document={
    createElement(){
      return {
        width:0,height:0,
        getContext(){
          return {
            drawImage(){},
            getImageData(){
              return {width:2,height:2,data:new Uint8ClampedArray([
                255,0,0,255, 255,0,0,255,
                0,255,0,255, 0,255,0,255,
              ])};
            },
          };
        },
      };
    },
  };
  return ()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous};
}

test('pixel provider does not close a caller-owned drawable',async()=>{
  const restore=installCanvas();
  let closed=0;
  const drawable={width:2,height:2,close(){closed++}};
  try{
    const provider=new PixelColorStateProvider();
    await provider.analyze(drawable,{capabilities:['color_state']});
    assert.equal(closed,0);
  }finally{restore()}
});

test('pixel provider closes an ImageBitmap it creates from a Blob',async()=>{
  const restore=installCanvas();
  const previousFactory=globalThis.createImageBitmap;
  let closed=0,created=0;
  globalThis.createImageBitmap=async()=>{created++;return {width:2,height:2,close(){closed++}}};
  try{
    const provider=new PixelColorStateProvider();
    await provider.analyze(new Blob(['x'],{type:'image/png'}),{capabilities:['color_state']});
    assert.equal(created,1);
    assert.equal(closed,1);
  }finally{
    restore();
    if(previousFactory===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previousFactory;
  }
});

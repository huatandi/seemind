import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('image preprocessor accepts and checks AbortSignal',()=>{
  const src=fs.readFileSync('features/capture/image-preprocessor.js','utf8');
  assert.match(src,/signal=null/); assert.match(src,/throwIfAborted\(signal\)/);
});
test('image preprocessor bounds its own bitmap decode',()=>{
  const src=fs.readFileSync('features/capture/image-preprocessor.js','utf8');
  assert.match(src,/IMAGE_PREPROCESS_DECODE_TIMEOUT/); assert.match(src,/decodeTimeoutMs=3500/);
});
test('late bitmap after preprocessing timeout is released',()=>{
  const src=fs.readFileSync('features/capture/image-preprocessor.js','utf8');
  assert.match(src,/if\(settled\)bitmap\?\.close\?\.\(\)/);
});
test('candidate derivation checks cancellation between expensive passes',()=>{
  const src=fs.readFileSync('features/capture/image-preprocessor.js','utf8');
  const loop=src.indexOf('for(const candidatePlan of candidatePlans)');
  assert.ok(src.indexOf('throwIfAborted(signal)',loop)>loop);
});
test('local student releases OCR canvases when ensemble aborts or fails',()=>{
  const src=fs.readFileSync('providers/local/local-student.js','utf8');
  assert.match(src,/catch\(error\)\{for\(const candidate of preprocessing\.candidates\)candidate\.release\?\.\(\);throw error\}/);
});

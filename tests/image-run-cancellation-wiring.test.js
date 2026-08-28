import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../apps/web/src/main.js',import.meta.url),'utf8');
test('new image selection actively aborts previous perception work',()=>{assert.match(source,/imageRunController\?\.abort\(\)/);assert.match(source,/createPreparedImageSource\(f,\{signal:controller\.signal\}\)/);assert.match(source,/observeImage\(f,\{ocrEngines,userQuestion:captureQuestion,ocrLanguage:'auto',signal:controller\.signal/)});
test('cancelled image run cannot remain active or clear a newer run',()=>{assert.match(source,/runId===imageRunSeq&&!controller\.signal\.aborted/);assert.match(source,/if\(runId===imageRunSeq\)/)});

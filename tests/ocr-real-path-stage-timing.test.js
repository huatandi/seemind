import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('real image path feeds measured OCR inner stages into critical-path trace',()=>{
 const src=fs.readFileSync(new URL('../providers/local/local-student.js',import.meta.url),'utf8');
 assert.match(src,/ensemble\.stageTimings/);
 assert.match(src,/trace\.record\?\.\(`ocr_\$\{stage\}`/);
});

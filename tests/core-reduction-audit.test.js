import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
test('obsolete specialist selector stays removed and canonical teacher path remains',()=>{
  assert.equal(fs.existsSync(path.resolve('core/orchestration/specialist-selector.js')),false);
  assert.equal(fs.existsSync(path.resolve('core/orchestration/intelligence-gap-router.js')),true);
  assert.equal(fs.existsSync(path.resolve('core/teacher/teacher-router.js')),true);
});

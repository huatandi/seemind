import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('architecture freeze keeps one canonical routing and verification authority',()=>{
 for(const f of ['core/orchestration/unified-orchestrator.js','core/orchestration/intelligence-gap-router.js','core/teacher/teacher-router.js','core/verification/verification-core.js'])assert.equal(fs.existsSync(f),true,f);
 for(const f of ['core/orchestration/specialist-selector.js','core/decision/decision-engine.js','core/teacher/teacher-performance.js'])assert.equal(fs.existsSync(f),false,f);
});

test('Pilot Lab stays available but outside the normal startup implementation',()=>{
 const main=fs.readFileSync('apps/web/src/main.js','utf8');
 assert.match(main,/import\('\.\/runtime\/pilot-lab-runtime\.js'\)/);
 assert.doesNotMatch(main,/from ['"].*pilot-lab-controller\.js['"]/);
 assert.doesNotMatch(main,/from ['"].*benchmark-competition\.js['"]/);
 assert.equal(fs.existsSync('apps/web/src/runtime/pilot-lab-runtime.js'),true);
});

test('production entry remains bounded after final slimming',()=>{
 const lines=fs.readFileSync('apps/web/src/main.js','utf8').split(/\r?\n/).length;
 assert.ok(lines<=600,`main.js is ${lines} lines`);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('obsolete boolean teacher performance store stays removed in favor of verified outcome learning',()=>{
 assert.equal(fs.existsSync('core/teacher/teacher-performance.js'),false);
 assert.equal(fs.existsSync('core/orchestration/specialist-outcome-learning.js'),true);
});
test('deprecated decision engine stays removed so Unified Orchestrator is the only routing authority',()=>{
 assert.equal(fs.existsSync('core/decision/decision-engine.js'),false);
 assert.equal(fs.existsSync('core/orchestration/unified-orchestrator.js'),true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html=fs.readFileSync(path.resolve('apps/web/annotation.html'),'utf8');

test('annotation console is isolated from main SeeMind page',()=>{
  const main=fs.readFileSync(path.resolve('apps/web/index.html'),'utf8');
  assert.equal(main.includes('fieldRows'),false);
  assert.match(html,/id="fieldRows"/);
});

test('annotation console exposes only explicit review actions',()=>{
  assert.match(html,/id="submitReview"/);
  assert.match(html,/id="rejectReview"/);
  assert.match(html,/id="approveReview"/);
  assert.match(html,/确认进入测试库/);
});

test('privacy confirmations are explicit in UI',()=>{
  assert.match(html,/id="consent"/);
  assert.match(html,/id="redacted"/);
  assert.match(html,/人工确认图片中的个人敏感信息/);
});

test('annotation UI supports multiple image selection and batch queue filters',()=>{
  assert.match(html,/type="file"[^>]*multiple/);
  assert.match(html,/id="queueList"/);
  assert.match(html,/data-filter="annotation"/);
  assert.match(html,/data-filter="review"/);
  assert.match(html,/data-filter="eligible"/);
});

test('annotation UI exposes previous skip and next navigation',()=>{
  assert.match(html,/id="prevReceipt"/);
  assert.match(html,/id="skipReceipt"/);
  assert.match(html,/id="nextReceipt"/);
  assert.match(html,/id="resumeBatch"/);
});

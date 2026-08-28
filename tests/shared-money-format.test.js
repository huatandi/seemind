import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoneyMinor,DEFAULT_MONEY_LOCALE} from '../core/shared/money.js';

test('money rendering is deterministic regardless of host OS locale',()=>{
  // Same input must render identically everywhere; the historical bug was
  // falling through to the process locale ('USD 108,00' vs '$108.00').
  const a=formatMoneyMinor(10800);
  const b=formatMoneyMinor(10800,{locale:undefined});
  assert.equal(a,'$108.00');
  assert.equal(b,a);
});

test('explicit locale from Global Context is honored',()=>{
  // es-MX renders MXN with the $ symbol and no decimal group on 108.
  assert.equal(formatMoneyMinor(10800,{locale:'es-MX',currency:'MXN'}),'$108.00');
  const s=formatMoneyMinor(99000,{locale:'ja-JP',currency:'JPY'});
  assert.ok(/990/.test(s));
});

test('unresolved currency (XXX) renders with neutral symbol instead of throwing',()=>{
  assert.equal(formatMoneyMinor(123456,{currency:'XXX'}),'$1,234.56');
});

test('non-numeric input returns String() fallback without throwing',()=>{
  assert.equal(formatMoneyMinor(undefined),String(undefined));
  assert.equal(formatMoneyMinor('abc'),'abc');
});

test('default locale constant is pinned',()=>{
  assert.equal(DEFAULT_MONEY_LOCALE,'en-US');
});

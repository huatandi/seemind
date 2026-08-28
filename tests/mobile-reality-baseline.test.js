import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDeviceProfile} from '../core/device/device-profile.js';
import {createPerceptionBudget} from '../core/perception/perception-budget.js';

test('iPhone-like browser with hidden RAM is treated conservatively, not as desktop-capable',()=>{
  const p=detectDeviceProfile({navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',hardwareConcurrency:6}});
  assert.equal(p.mobile,true);
  assert.equal(p.platform.ios,true);
  assert.equal(p.platform.mobileUnknownMemory,true);
  assert.equal(p.tier,'balanced');
  assert.equal(p.budgets.maxVisualMemoryMb,256);
  assert.equal(p.budgets.maxInferenceMs,4500);
});

test('mobile unknown-memory perception budget exposes uncertainty and remains bounded',()=>{
  const p=detectDeviceProfile({navigator:{userAgent:'Mozilla/5.0 (iPhone)',hardwareConcurrency:6}});
  const b=createPerceptionBudget(p,{primaryRoute:'universal_vision'});
  assert.equal(b.deviceUncertainty,'MOBILE_MEMORY_UNKNOWN');
  assert.ok(b.heavyModels<=1);
  assert.ok(b.totalLocalMs<=p.budgets.maxInferenceMs);
  assert.equal(b.maxVisualMemoryMb,256);
});

test('known high-end WebGPU device may still enter performance tier',()=>{
  const p=detectDeviceProfile({navigator:{userAgent:'Desktop',hardwareConcurrency:12,deviceMemory:8,gpu:{}}});
  assert.equal(p.tier,'performance');
  assert.equal(p.platform.mobileUnknownMemory,false);
});

import {detectDeviceProfile} from '../../device/device-profile.js';
export function collectBenchmarkDeviceProfile(env=globalThis){
 const nav=env?.navigator??{};
 const runtime=detectDeviceProfile(env);
 return {
  schemaVersion:2,
  platform:nav.userAgentData?.platform??nav.platform??'unknown',
  mobile:runtime.mobile,
  cores:runtime.cores,
  memoryGb:runtime.memoryGb,
  webgpu:runtime.webgpu,
  wasm:runtime.wasm,
  userAgent:String(nav.userAgent??''),
  tier:runtime.tier,
  budgets:{...runtime.budgets},
  connection:{...runtime.connection},
  uncertainty:{mobileMemoryUnknown:Boolean(runtime.platform?.mobileUnknownMemory)},
 };
}
function inferTier(nav){
 const cores=Number(nav.hardwareConcurrency??0),mem=Number(nav.deviceMemory??0);
 if((mem&&mem<=4)||(cores&&cores<=4))return 'low_power';
 if((mem>=8)||(cores>=8))return 'performance';
 return 'balanced';
}

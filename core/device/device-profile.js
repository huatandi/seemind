export function detectDeviceProfile(env=globalThis){
  const nav=env?.navigator??{};
  const cores=Number(nav.hardwareConcurrency)||null;
  const memoryGb=Number(nav.deviceMemory)||null;
  const connection=nav.connection??nav.mozConnection??nav.webkitConnection??null;
  const effectiveType=connection?.effectiveType??null;
  const saveData=Boolean(connection?.saveData);
  const webgpu=Boolean(nav.gpu);
  const wasm=typeof WebAssembly!=='undefined';
  const userAgent=String(nav.userAgent??'');
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const ios=/iPhone|iPad|iPod/i.test(userAgent);
  const android=/Android/i.test(userAgent);
  const memoryUnknown=memoryGb==null;
  const lowMemory=memoryGb!=null&&memoryGb<=2;
  const lowCores=cores!=null&&cores<=4;
  const constrainedNetwork=saveData||['slow-2g','2g'].includes(String(effectiveType));
  // Mobile Safari commonly hides deviceMemory. Unknown RAM must not be interpreted
  // as evidence that a phone can safely carry a desktop-sized model.
  const mobileUnknownMemory=mobile&&memoryUnknown;
  const tier=(lowMemory||lowCores)?'low_power':((!mobileUnknownMemory&&memoryGb!=null&&memoryGb>=4)&&(cores==null||cores>=8)&&webgpu?'performance':'balanced');
  const maxVisualMemoryMb=tier==='low_power'?160:tier==='performance'?768:(mobileUnknownMemory?256:384);
  const maxInferenceMs=tier==='low_power'?3500:tier==='performance'?9000:(mobile?4500:6000);
  return {
    schemaVersion:1,
    tier,
    mobile,
    platform:{ios,android,memoryUnknown,mobileUnknownMemory},
    cores,
    memoryGb,
    webgpu,
    wasm,
    connection:{effectiveType,saveData,constrained:constrainedNetwork},
    budgets:{
      maxVisualMemoryMb,
      maxInferenceMs,
      maxConcurrentHeavyModels:tier==='performance'?2:1,
    },
    evidence:{
      hardwareConcurrency:cores!=null,
      deviceMemory:memoryGb!=null,
      webgpu:webgpu,
      networkHints:Boolean(connection),
      memoryKnown:!memoryUnknown,
      mobileMemoryUncertain:mobileUnknownMemory,
    },
  };
}

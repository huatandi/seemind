const REQUESTS=Object.freeze({
  specific_identity:{
    target:'identity_marker',
    instruction:'请补拍最能显示品牌、型号、铭牌或标签的清晰近照；让品牌名和 MODEL / Modelo 等型号文字完整可读。',
    reason:'Specific identity needs brand/model evidence, not only a generic object category.',
    expectedEvidence:['brand','model_candidate','exact_model','ocr_text'],
  },
  visual_grounding:{
    target:'referenced_region',
    instruction:'请把你说的“这个/那个/第几个/左边/右边”与周围参照物一起拍进画面，或再靠近目标区域拍一张。',
    reason:'The referenced object or region is not yet visually grounded.',
    expectedEvidence:['region','spatial_relationship'],
  },
  anomaly_inspection:{
    target:'anomaly_region',
    instruction:'请补拍异常位置的清晰近照，并保留一点周围结构；如果有指示灯、错误代码、裂纹、渗漏或烧痕，请让它清楚可见。',
    reason:'Troubleshooting needs direct visual evidence of the abnormal state.',
    expectedEvidence:['state_anomaly','component','ocr_text'],
  },
  component_parts:{
    target:'component_region',
    instruction:'请补拍相关部件、接口、线缆或按钮的近照，同时保留它与主体设备的连接关系。',
    reason:'Component-level questions need a closer view with enough context.',
    expectedEvidence:['component','spatial_relationship'],
  },
  spatial_relationships:{
    target:'relationship_view',
    instruction:'请把相关的两个或多个物体/部件同时拍进同一张图，避免只拍其中一个局部。',
    reason:'Spatial relationships require the relevant objects to be visible together.',
    expectedEvidence:['spatial_relationship'],
  },
  color_state:{
    target:'state_indicator',
    instruction:'请靠近拍清楚指示灯、屏幕或状态区域，并尽量避免反光和过曝。',
    reason:'State/color interpretation needs a clear view of the indicator region.',
    expectedEvidence:['state_anomaly','color_state'],
  },
  object_identity:{
    target:'whole_object',
    instruction:'请补拍包含完整物体主体和少量周围环境的清晰照片；如果有 Logo、标签或铭牌，也请让它可见。',
    reason:'Basic identity needs the whole object and useful disambiguating context.',
    expectedEvidence:['category','scene','brand'],
  },
  scene_context:{
    target:'wider_scene',
    instruction:'请稍微退后，把完整物体和周围环境一起拍进画面。',
    reason:'Scene context may disambiguate the object or situation.',
    expectedEvidence:['scene','category'],
  },
});

export function planNextBestVisualEvidence({missingCapabilities=[],observation={},problem={}}={}){
  const missing=[...new Set(missingCapabilities)].filter(Boolean);
  if(!missing.length)return {needed:false,requests:[],gapCapabilities:[]};
  const ranked=missing
    .map(cap=>({cap,...REQUESTS[cap]}))
    .filter(x=>x.target)
    .sort((a,b)=>priority(a.cap)-priority(b.cap));
  if(!ranked.length)return {needed:false,requests:[],gapCapabilities:missing};
  // Ask for the single highest-value capture first. More instructions at once
  // increase user effort and can produce redundant photos.
  const x=ranked[0];
  return {
    needed:true,
    gapCapabilities:missing,
    requests:[{
      kind:'capture_guidance',
      priority:1,
      capability:x.cap,
      target:x.target,
      instruction:x.instruction,
      reason:x.reason,
      expectedEvidence:x.expectedEvidence,
      evidencePolicy:'request_missing_evidence_do_not_guess',
    }],
    principle:'Ask for the cheapest decisive visual evidence before expensive escalation when the user can provide it.',
  };
}

function priority(cap){
  return ({visual_grounding:1,specific_identity:2,anomaly_inspection:3,component_parts:4,
    spatial_relationships:5,color_state:6,object_identity:7,scene_context:8})[cap]??99;
}

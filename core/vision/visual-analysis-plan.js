import {routeVisualCapabilities} from './visual-capability-router.js';
export function buildVisualAnalysisPlan(args={}){
  const route=routeVisualCapabilities(args);
  return {
    schemaVersion:1,
    route,
    steps:route.requested.map((x,i)=>({
      order:i+1,capability:x.capability,
      execution:x.available?'local':'defer',
      required:x.required,
      reason:x.reasons.join('; '),
      fallback:!x.available?(x.capability==='visual_grounding'?'collect_better_image_or_pointing_evidence':'vision_teacher_or_specialist'):null,
    })),
    providerExecution:{
      requiredCapabilities:route.requested.filter(x=>x.required&&!x.available).map(x=>x.capability),
      localCapabilities:route.localCapabilities,
    },
    escalation:{
      needed:route.needsVisionTeacher,
      preferredKinds:route.needsVisionTeacher?['vision']:[],
      unresolvedCapabilities:route.missingCapabilities,
      sendPolicy:'minimum_necessary',
      sendOriginalImage:route.needsVisionTeacher,
    },
  };
}

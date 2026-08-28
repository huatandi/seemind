export function createRouteContract({route,reason,details={},context={},alternatives=[]}={}){
  const contract={
    schemaVersion:1,
    authority:'unified_orchestrator',
    route,
    reason,
    phase:context.phase??'ASSESS',
    inputSnapshot:{
      riskLevel:context.safety?.risk?.level??null,
      resolution:context.evidence?.resolution?.decision??null,
      retrievalRequired:Boolean(context.retrieval?.plan?.shouldSearch),
      searchStatus:context.retrieval?.packageSearch?.status??null,
      evidenceConsensus:context.evidence?.consensus?.status??null,
      teacherCount:Number(context.external?.teacherCount??0),
      searchAvailable:Boolean(context.external?.searchAvailable),
      taskGraphNodes:context.planning?.taskGraph?.nodes?.length??0,
    },
    details,
    alternatives:alternatives.map(x=>({route:x.route,rejectedBecause:x.rejectedBecause})),
    nextStage:nextStage(route),
    mustReenter:['SEARCH','PLAN','TEACHER'].includes(route),
    terminal:['LOCAL','HUMAN','STOP'].includes(route),
  };
  return Object.freeze(contract);
}
function nextStage(route){
 const m={LOCAL:'EXPLAIN',CLARIFY:'COLLECT_EVIDENCE',SEARCH:'RETRIEVE',PLAN:'EXECUTE_PLAN',TEACHER:'CALL_SPECIALIST',HUMAN:'REFER',STOP:'REPORT_BOUNDARY'};
 return m[route]??'REPORT_BOUNDARY';
}

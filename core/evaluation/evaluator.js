import {replayAudit} from '../audit/audit-replay.js';

export const FAILURE_CATEGORIES=Object.freeze({
  PERCEPTION:'perception_error',
  ENTITY:'entity_error',
  ROUTER:'router_error',
  TEACHER_OUTPUT:'teacher_output_invalid',
  SEARCH_SOURCE:'search_source_failure',
  EVIDENCE:'evidence_failure',
  PROVIDER:'provider_failure',
  CONTRACT:'contract_failure',
  USER_INPUT:'user_input_insufficient',
  BUDGET:'budget_failure',
  EXECUTION:'execution_failure',
});

export function evaluateAuditTrail(events=[],options={}){
  const replay=replayAudit(events);
  const findings=[];
  for(const event of events){
    const finding=classifyAuditEvent(event);
    if(finding)findings.push(finding);
  }
  const deduped=dedupeFindings(findings);
  const categoryCounts=countBy(deduped,x=>x.category);
  const blocking=deduped.filter(x=>x.blocking);
  const primary=selectPrimaryFailure(deduped,replay);
  const solved=replay.status==='completed'&&replay.finalDecision?.type!=='result_rejected'&&!blocking.length;
  const score=qualityScore({replay,findings:deduped,solved});
  return {
    schemaVersion:1,
    evaluationId:options.evaluationId??randomId('eval'),
    executionId:replay.executionId,
    taskId:replay.taskId,
    evaluatedAt:options.evaluatedAt??new Date().toISOString(),
    taskSolved:solved,
    score,
    primaryFailure:primary,
    findings:deduped,
    categoryCounts,
    signals:{
      failureCount:deduped.length,
      blockingFailureCount:blocking.length,
      teacherAttempts:replay.teacherSelections.length,
      searchRounds:replay.searches.filter(x=>x.type==='search_completed').length,
      evidenceWarnings:replay.warnings.length,
      finalDecision:replay.finalDecision?.type??null,
      executionStatus:replay.status,
    },
    recommendation:recommendationFor({solved,primary,findings:deduped,replay}),
  };
}

export function classifyAuditEvent(event={}){
  const type=String(event.type??'');const d=event.data??{};
  if(type==='perception_failed'||type==='ocr_failed')return finding(FAILURE_CATEGORIES.PERCEPTION,event,d.code??'PERCEPTION_FAILED',true,'perception');
  if(type==='identity_resolution_failed'||(type==='planner_graph_blocked'&&['IDENTITY_NEEDS_INPUT','IDENTITY_UNRESOLVED'].includes(d.code)))return finding(FAILURE_CATEGORIES.ENTITY,event,d.code??'IDENTITY_UNRESOLVED',true,'entity');
  if(type==='identity_verified'&&Number(d.confidence)<0.65)return finding(FAILURE_CATEGORIES.ENTITY,event,'LOW_IDENTITY_CONFIDENCE',false,'entity');
  if(type==='teacher_invalid'){
    const issues=flattenIssues(d.issues);
    if(issues.some(x=>/schema|contract|json|required|format/i.test(x)))return finding(FAILURE_CATEGORIES.CONTRACT,event,'TEACHER_SCHEMA_INVALID',true,'contract');
    if(issues.some(x=>/evidence|unsupported|freshness|claim/i.test(x)))return finding(FAILURE_CATEGORIES.EVIDENCE,event,'TEACHER_EVIDENCE_INVALID',true,'evidence');
    return finding(FAILURE_CATEGORIES.TEACHER_OUTPUT,event,'TEACHER_OUTPUT_INVALID',true,'teacher');
  }
  if(type==='teacher_error')return finding(FAILURE_CATEGORIES.PROVIDER,event,normalizeProviderCode(d.error),true,'provider');
  if(type==='result_rejected')return finding(/VALIDATION|SCHEMA|CONTRACT/i.test(String(d.reason))?FAILURE_CATEGORIES.CONTRACT:FAILURE_CATEGORIES.TEACHER_OUTPUT,event,d.reason??'RESULT_REJECTED',true,'validation');
  if(type==='search_failed')return finding(FAILURE_CATEGORIES.SEARCH_SOURCE,event,d.code??'SEARCH_FAILED',true,'search');
  if(type==='search_completed'&&Number(d.evidenceCount)===0)return finding(FAILURE_CATEGORIES.SEARCH_SOURCE,event,'SEARCH_NO_EVIDENCE',false,'search');
  if(type==='evidence_consensus'&&d.status==='conflicted'&&d.resolutionStatus!=='resolved')return finding(FAILURE_CATEGORIES.EVIDENCE,event,'EVIDENCE_CONFLICT_UNRESOLVED',true,'evidence');
  if(type==='evidence_consensus'&&['insufficient','none'].includes(String(d.status)))return finding(FAILURE_CATEGORIES.EVIDENCE,event,'EVIDENCE_INSUFFICIENT',false,'evidence');
  if(type==='planner_graph_blocked'&&d.reason==='ASK_USER')return finding(FAILURE_CATEGORIES.USER_INPUT,event,d.code??'USER_INPUT_REQUIRED',false,'user');
  if(type==='planner_graph_stopped'&&['MAX_STEPS','MAX_LATENCY','MAX_FAILURES'].includes(d.reason))return finding(FAILURE_CATEGORIES.BUDGET,event,d.reason,true,'budget');
  if(type==='planner_node_failed')return finding(FAILURE_CATEGORIES.EXECUTION,event,d.code??d.error??'NODE_FAILED',true,'execution');
  if(type==='router_no_candidate')return finding(FAILURE_CATEGORIES.ROUTER,event,d.code??'NO_ROUTER_CANDIDATE',true,'router');
  if(type==='user_feedback'){
    const category=String(d.category??'');
    const mapped={wrong_entity:FAILURE_CATEGORIES.ENTITY,wrong_source:FAILURE_CATEGORIES.EVIDENCE,wrong_fact:FAILURE_CATEGORIES.EVIDENCE,wrong_recommendation:FAILURE_CATEGORIES.TEACHER_OUTPUT,wrong_action:FAILURE_CATEGORIES.EXECUTION,wrong_router:FAILURE_CATEGORIES.ROUTER}[category];
    if(mapped)return finding(mapped,event,`USER_${category.toUpperCase()}`,true,'feedback');
  }
  return null;
}

function finding(category,event,code,blocking,owner){return {id:`finding:${event.id??randomId('event')}:${category}`,category,code:String(code).slice(0,120),blocking:Boolean(blocking),owner,eventId:event.id??null,at:event.at??null,nodeId:event.data?.nodeId??null,providerId:event.data?.providerId??null}}
function flattenIssues(v){if(v==null)return [];if(Array.isArray(v))return v.flatMap(flattenIssues);if(typeof v==='object')return Object.entries(v).flatMap(([k,x])=>[k,...flattenIssues(x)]);return [String(v)]}
function normalizeProviderCode(v){const s=String(v??'PROVIDER_FAILED');if(/timeout/i.test(s))return 'PROVIDER_TIMEOUT';if(/quota|rate/i.test(s))return 'PROVIDER_QUOTA_OR_RATE_LIMIT';if(/network|fetch|ECONN|ENOTFOUND/i.test(s))return 'PROVIDER_NETWORK_ERROR';return 'PROVIDER_FAILED'}
function dedupeFindings(items){const m=new Map();for(const x of items){const key=[x.category,x.code,x.nodeId,x.providerId].join('|');if(!m.has(key))m.set(key,x)}return [...m.values()]}
function countBy(items,key){const out={};for(const x of items){const k=key(x);out[k]=(out[k]??0)+1}return out}
function selectPrimaryFailure(findings,replay){if(!findings.length)return null;const priority=[FAILURE_CATEGORIES.CONTRACT,FAILURE_CATEGORIES.EVIDENCE,FAILURE_CATEGORIES.ENTITY,FAILURE_CATEGORIES.PERCEPTION,FAILURE_CATEGORIES.ROUTER,FAILURE_CATEGORIES.PROVIDER,FAILURE_CATEGORIES.SEARCH_SOURCE,FAILURE_CATEGORIES.USER_INPUT,FAILURE_CATEGORIES.BUDGET,FAILURE_CATEGORIES.EXECUTION];return [...findings].sort((a,b)=>Number(b.blocking)-Number(a.blocking)||priority.indexOf(a.category)-priority.indexOf(b.category))[0]??null}
function qualityScore({replay,findings,solved}){let score=solved?100:72;for(const f of findings)score-=f.blocking?12:4;if(replay.warnings.length)score-=Math.min(15,replay.warnings.length*3);return Math.max(0,Math.min(100,score))}
function recommendationFor({solved,primary,findings,replay}){if(solved&&!findings.length)return 'accept';if(primary?.category===FAILURE_CATEGORIES.USER_INPUT)return 'ask_user';if(primary?.category===FAILURE_CATEGORIES.PROVIDER||primary?.category===FAILURE_CATEGORIES.ROUTER)return 'retry_or_fallback';if(primary?.category===FAILURE_CATEGORIES.SEARCH_SOURCE||primary?.category===FAILURE_CATEGORIES.EVIDENCE)return 'retrieve_better_evidence';if(primary?.category===FAILURE_CATEGORIES.ENTITY)return 'verify_identity';if(replay.status==='budget_exceeded')return 'stop_and_report_limits';return solved?'accept_with_warning':'offline_evaluation_required'}
function randomId(prefix){return globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`}

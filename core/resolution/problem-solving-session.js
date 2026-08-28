import {createEvidenceGraph,addPhotoEvidence,buildEntityEvidenceSummary} from '../evidence/evidence-graph.js';

export function createProblemSolvingSession(input={}){
  return {
    schemaVersion:2,
    id:input.id??randomId(),
    status:input.status??'investigating',
    goal:input.goal??null,
    subject:input.subject??null,
    symptoms:[...(input.symptoms??[])],
    evidence:[...(input.evidence??[])],
    attempts:[...(input.attempts??[])],
    attemptResults:[...(input.attemptResults??[])],
    ruledOut:[...(input.ruledOut??[])],
    openQuestions:[...(input.openQuestions??[])],
    proposedSteps:[...(input.proposedSteps??[])],
    resolution:input.resolution??null,
    resolutionState:input.resolutionState??null,
    escalation:input.escalation??null,
    lifecycle:{
      generation:input.lifecycle?.generation??0,
      resolvedAt:input.lifecycle?.resolvedAt??null,
      reopenedAt:input.lifecycle?.reopenedAt??null,
      pausedAt:input.lifecycle?.pausedAt??null,
      closedAt:input.lifecycle?.closedAt??null,
      lastTransition:input.lifecycle?.lastTransition??null,
    },
    evidenceGraph:createEvidenceGraph(input.evidenceGraph??{}),
    activeEntitySummary:input.activeEntitySummary??null,
    lastPhotoRelationship:input.lastPhotoRelationship??null,
    createdAt:input.createdAt??new Date().toISOString(),
    updatedAt:input.updatedAt??new Date().toISOString(),
  };
}

export function updateProblemSolvingSession(state,{problem=null,observation=null,userText='',assistantText=''}={}){
  const next=createProblemSolvingSession(state??{});
  const text=String(userText||'').trim();
  if(problem){
    next.goal=problem.goal??next.goal;
    next.subject=mergeSubject(next.subject,problem.referencedObjects?.[0]);
    next.symptoms=mergeUnique(next.symptoms,(problem.symptoms??[]).map(x=>normalizeSymptom(x)));
    next.openQuestions=mergeUnique(next.openQuestions,problem.missingInformation??[]);
  }
  if(hasObservationEvidence(observation)){
    const fresh=extractEvidence(observation);
    next.evidence=mergeUnique(next.evidence,fresh);
    const linked=addPhotoEvidence(next.evidenceGraph,{observation,userText:text});
    next.evidenceGraph=linked.graph;
    next.activeEntitySummary=buildEntityEvidenceSummary(linked.graph,linked.graph.activeEntityId);
    next.lastPhotoRelationship={status:linked.match.status,confidence:linked.match.confidence,reasons:linked.match.reasons,photoId:linked.photo.id,entityId:linked.photo.entityId,viewType:linked.photo.viewType};
  }
  if(text){
    const now=new Date().toISOString();
    const previousStatus=next.status;
    const lifecycleIntent=detectLifecycleIntent(text,previousStatus);
    next.attempts=mergeUnique(next.attempts,extractAttempts(text));
    const outcome=detectOutcome(text);

    if(lifecycleIntent==='pause'){
      next.status='paused';
      next.lifecycle={...next.lifecycle,pausedAt:now,lastTransition:{from:previousStatus,to:'paused',reason:'user_paused',at:now}};
    }else if(lifecycleIntent==='close'){
      next.status='closed';
      next.lifecycle={...next.lifecycle,closedAt:now,lastTransition:{from:previousStatus,to:'closed',reason:'user_closed',at:now}};
    }else if(lifecycleIntent==='resume'){
      next.status='investigating';
      next.lifecycle={...next.lifecycle,lastTransition:{from:previousStatus,to:'investigating',reason:'user_resumed',at:now}};
    }else if(lifecycleIntent==='reopen'){
      next.status='investigating';
      next.resolution=null;
      next.lifecycle={...next.lifecycle,generation:(next.lifecycle?.generation??0)+1,reopenedAt:now,lastTransition:{from:previousStatus,to:'investigating',reason:'problem_recurred',at:now}};
      next.evidence=markHistorical(next.evidence,next.lifecycle.generation);
      next.symptoms=markHistorical(next.symptoms,next.lifecycle.generation);
    }else if(outcome==='resolved'){
      next.status='resolved';next.resolution={source:'user_report',text,at:now};
      next.lifecycle={...next.lifecycle,resolvedAt:now,lastTransition:{from:previousStatus,to:'resolved',reason:'user_reported_resolved',at:now}};
      next.attemptResults=appendAttemptResult(next.attemptResults,next.attempts.at(-1),outcome,text);
    }else if(outcome==='not_resolved'){
      next.status='investigating';next.resolution=null;
      next.lifecycle={...next.lifecycle,lastTransition:{from:previousStatus,to:'investigating',reason:'still_not_resolved',at:now}};
      next.attemptResults=appendAttemptResult(next.attemptResults,next.attempts.at(-1),outcome,text);
    }
  }
  next.updatedAt=new Date().toISOString();
  return next;
}

export function planUniversalNextActions({state,problem,resolution,helpPath,evidenceRequest=null,worldDomain=null}={}){
  const domain=String(worldDomain?.primary??worldDomain??'general');
  if(domain==='repair')return planGuidedTroubleshooting({state,problem,resolution,helpPath,evidenceRequest});
  if(['resolved','paused','closed'].includes(state?.status))return {
    schemaVersion:1,kind:'universal_next_actions',domain,status:state.status,nextStep:null,alternatives:[],avoidedRepeats:0,shouldEscalate:false,lifecycleHold:true,
  };
  const candidates=[];
  if(evidenceRequest?.request?.instruction)candidates.push({kind:'capture',text:evidenceRequest.request.instruction,reason:evidenceRequest.request.gap?.type??'evidence_gap',capture:evidenceRequest.request});
  for(const e of resolution?.nextEvidence??[])if(e?.instruction)candidates.push({kind:'evidence',text:e.instruction,reason:e.reason??'resolution_evidence'});
  if(!candidates.length&&resolution?.escalation?.needed&&helpPath?.message)candidates.push({kind:'help',text:helpPath.message,reason:'bounded_escalation'});
  return {
    schemaVersion:1,kind:'universal_next_actions',domain,status:state?.status??'investigating',
    nextStep:candidates[0]??null,alternatives:candidates.slice(1,3),avoidedRepeats:0,
    shouldEscalate:Boolean(!candidates.length&&resolution?.escalation?.needed),lifecycleHold:false,
  };
}

export function planGuidedTroubleshooting({state,problem,resolution,helpPath,evidenceRequest=null}={}){
  if(['resolved','paused','closed'].includes(state?.status)){
    return {
      schemaVersion:2,status:state.status,nextStep:null,alternatives:[],avoidedRepeats:0,shouldEscalate:false,
      lifecycleHold:true,
    };
  }
  const attempts=state?.attempts??[];
  const candidates=[];
  if(evidenceRequest?.request?.instruction)candidates.push({kind:'capture',text:evidenceRequest.request.instruction,reason:evidenceRequest.request.gap?.type??'evidence_gap',capture:evidenceRequest.request});
  for(const e of resolution?.nextEvidence??[]){
    const text=e.instruction??e.question??null;
    if(text)candidates.push({kind:'evidence',text,reason:e.reason??'missing_evidence'});
  }
  if((problem?.referencedObjects??[]).some(x=>x.requiresVisualGrounding)){
    candidates.push({kind:'evidence',text:'请把你说的那个位置拍近一点，尽量让目标占画面主要区域。',reason:'visual_grounding'});
  }
  for(const step of genericSteps(problem,state))candidates.push(step);
  if(resolution?.escalation?.needed&&helpPath?.message)candidates.push({kind:'escalate',text:helpPath.message,reason:'local_limit'});
  const filtered=candidates.filter(x=>!alreadyTried(x,attempts));
  const next=filtered[0]??null;
  return {
    schemaVersion:1,
    status:state?.status??'investigating',
    nextStep:next,
    alternatives:filtered.slice(1,3),
    avoidedRepeats:candidates.length-filtered.length,
    shouldEscalate:next?.kind==='escalate'||Boolean(resolution?.escalation?.needed&&!next),
  };
}

export function summarizeProblemState(state={}){
  return {
    status:state.status??'investigating',
    subject:state.subject??null,
    symptoms:(state.symptoms??[]).slice(-5),
    attempts:(state.attempts??[]).slice(-6),
    attemptResults:(state.attemptResults??[]).slice(-6),
    evidence:(state.evidence??[]).slice(-6),
    activeEntity:state.activeEntitySummary??null,
    lastPhotoRelationship:state.lastPhotoRelationship??null,
    resolution:state.resolution??null,
    resolutionState:state.resolutionState??null,
    lifecycle:state.lifecycle??null,
  };
}

function genericSteps(problem,state){
  const out=[],text=[problem?.userQuestion,...(state?.symptoms??[]).map(x=>x.text)].filter(Boolean).join(' ');
  if(/灯|闪|亮|light|blink|parpade/i.test(text)){
    out.push({kind:'check',actionId:'inspect_indicator',text:'先确认指示灯的颜色、闪烁节奏，以及设备屏幕上是否同时出现错误代码；把这些信息告诉我或拍清楚。',reason:'indicator_diagnosis'});
  }
  if(/不工作|没反应|无法启动|不开机|not work|no funciona|no enciende/i.test(text)){
    out.push({kind:'check',actionId:'basic_power_path',text:'确认电源、连接线和明显的开关状态；如果已经检查过，请直接告诉我结果，我不会让你重复做。',reason:'basic_power_path'});
  }
  return out;
}
function extractAttempts(text){
  const clauses=text.split(/[。！？!?；;\n]/).map(x=>x.trim()).filter(Boolean),out=[];
  for(const c of clauses){
    if(/已经|试过|刚才|做过|换过|重启|拔过|插过|检查过|清理过|reset|restart|reinici|prob[eé]|intent[eé]/i.test(c)){
      out.push({kind:'user_attempt',actionId:canonicalAction(c),text:c,normalized:normalize(c),at:new Date().toISOString()});
    }
  }
  return out;
}
function canonicalAction(text=''){
  const s=String(text);
  if(/重启|重新启动|断电.*重启|拔.*插|power.?cycle|restart|reset|reinici/i.test(s))return 'power_cycle';
  if(/电源|连接线|插头|开关|cable|power|enchufe|interruptor/i.test(s))return 'basic_power_path';
  if(/换.*电池|更换.*电池|battery|bater[ií]a/i.test(s))return 'battery_replaced';
  if(/清理|清洁|clean|limpi/i.test(s))return 'cleaned';
  if(/重装|重新安装|reinstall|reinstal/i.test(s))return 'reinstalled';
  if(/指示灯|红灯|绿灯|闪烁|error code|错误码|parpade/i.test(s))return 'inspect_indicator';
  return null;
}
function detectLifecycleIntent(text,status){
  const s=String(text??'');
  if(/先不管|暂时不管|先放着|稍后再说|回头再弄|pause|later|despu[eé]s|m[aá]s tarde/i.test(s))return 'pause';
  if(/不用处理了|这个问题结束|不再处理|关闭这个问题|close this|cerrar.*problema/i.test(s))return 'close';
  if(['paused','closed'].includes(status)&&/继续|接着|再看看|继续处理|resume|continue|continuar|seguir/i.test(s))return 'resume';
  if(status==='resolved'&&/又坏|又不行|又出现|又开始|复发|再次.*不|又.*闪|again|stopped working again|otra vez|de nuevo/i.test(s))return 'reopen';
  return null;
}
function markHistorical(items,generation){
  return (items??[]).map(x=>typeof x==='object'&&x?{...x,historical:true,historicalGeneration:generation-1}:x);
}
function detectOutcome(text){
  if(/已经好了|解决了|正常了|可以了|修好了|funciona|resuelto|solucionado/i.test(text))return 'resolved';
  if(/还是不行|没有解决|仍然|还是一样|sigue igual|no funciona/i.test(text))return 'not_resolved';
  return null;
}
function hasObservationEvidence(o){
  if(!o||typeof o!=='object')return false;
  if((o.observations??[]).length)return true;
  if(String(o.extractedText??'').trim())return true;
  if(o.image||o.imageId||o.mediaId||o.sourceImage)return true;
  return false;
}
function extractEvidence(o){
  const out=[];
  for(const x of o?.observations??[]){
    if(x.kind==='general_vision'){
      for(const y of x.identity??[])if(y.status==='observed')out.push({kind:'visual_identity',text:y.label,confidence:y.confidence});
      for(const y of x.states??[])out.push({kind:'visual_state',text:y.label,confidence:y.confidence});
      for(const y of x.anomalies??[])out.push({kind:'visual_anomaly',text:y.label,confidence:y.confidence});
    }
    if(x.kind==='receipt_fields'&&x.receipt?.total?.value!=null)out.push({kind:'document_total',text:String(x.receipt.total.value),confidence:x.receipt.total.confidence});
  }
  if(String(o?.extractedText??'').trim())out.push({kind:'ocr_text',text:String(o.extractedText).trim().slice(0,240),confidence:o?.confidence?.overall??null});
  return out;
}
function mergeSubject(a,b){if(a)return a;if(!b)return null;return {id:b.id??null,label:b.label??b.sourceText??b.type??null,sourceText:b.sourceText??null}}
function normalizeSymptom(x){return {type:x.type??'symptom',text:x.sourceText??x.text??x.type??'',confidence:x.confidence??null}}
function mergeUnique(a,b){const out=[...(a??[])],seen=new Set(out.map(itemKey));for(const x of b??[]){const k=itemKey(x);if(!seen.has(k)){seen.add(k);out.push(x)}}return out}
function itemKey(x){
  if(typeof x==='string')return normalize(x);
  if(x?.kind==='user_attempt'&&x.actionId)return `attempt:${x.actionId}`;
  return normalize(x?.normalized??x?.text??x?.label??JSON.stringify(x));
}
function alreadyTried(step,attempts){
  const actionId=step?.actionId??canonicalAction(step?.text??step);
  const s=normalize(step?.text??step);
  return attempts.some(a=>{
    const attemptedId=a.actionId??canonicalAction(a.normalized??a.text??'');
    if(actionId&&attemptedId){
      if(actionId===attemptedId)return true;
      if(actionId==='basic_power_path'&&attemptedId==='power_cycle')return true;
    }
    return similar(s,normalize(a.normalized??a.text??''));
  });
}
function appendAttemptResult(existing,attempt,outcome,text){
  if(!attempt)return existing??[];
  const row={actionId:attempt.actionId??canonicalAction(attempt.text),attemptText:attempt.text??null,outcome,text,at:new Date().toISOString()};
  const key=`${row.actionId??row.attemptText}:${outcome}`;
  const out=[...(existing??[])].filter(x=>`${x.actionId??x.attemptText}:${x.outcome}`!==key);
  out.push(row);return out.slice(-12);
}
function similar(a,b){if(!a||!b)return false;if(a.includes(b)||b.includes(a))return true;const A=new Set(a.split(' ').filter(x=>x.length>1)),B=new Set(b.split(' ').filter(x=>x.length>1));let hit=0;for(const x of A)if(B.has(x))hit++;return hit>=2&&hit/Math.max(1,Math.min(A.size,B.size))>=.5}
function normalize(s){return String(s??'').toLowerCase().replace(/[，。！？,.!?;；:："'“”‘’()（）]/g,' ').replace(/\s+/g,' ').trim()}
function randomId(){return globalThis.crypto?.randomUUID?.()??`ps_${Date.now()}_${Math.random().toString(16).slice(2)}`}

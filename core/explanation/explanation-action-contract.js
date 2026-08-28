export function buildExplanationActionContract({observation={},problem={},resolution={},multimodal=null,helpPath=null}={}){
  const mm=multimodal??findObservation(observation,'multimodal_context')??{};
  const known=problem.knownFacts??[];
  const userReported=buildUserReported(mm);
  const inferences=buildInferences({problem,resolution});
  const unknowns=uniqueUnknowns([
    ...(problem.unknownFacts??[]).map(x=>({id:x.id,reason:'fact_unresolved',label:x.name??x.id})),
    ...(problem.multimodalUnknowns??[]).map(x=>({id:x.id,reason:x.reason??'multimodal_unknown',label:x.id})),
  ]);
  const confidence=classifyConfidence(observation,problem,inferences);
  const actions=buildActions({problem,resolution,unknowns});
  const escalation=buildEscalation({resolution,helpPath});
  const safety=buildSafety({inferences,actions});

  return {
    schemaVersion:1,
    contract:'explanation_and_action',
    observed:{
      title:'我看到了什么',
      items:known.map(f=>({kind:'observed_fact',id:f.id,label:f.name,value:f.value,unit:f.unit??null,confidence:f.confidence??null,source:'visual_or_structured_evidence'})),
    },
    userReported:{
      title:'你告诉了我什么',
      items:userReported,
    },
    assessment:{
      title:'我认为这意味着什么',
      items:inferences,
      confidence,
    },
    actions:{
      title:'你现在可以怎么做',
      items:actions,
    },
    unknowns:{
      title:'我还不能确认什么',
      items:unknowns,
    },
    escalation:{
      title:'如果还不能解决',
      ...escalation,
    },
    safety,
    principles:{
      factsAreNotInferences:true,
      userReportsAreNotVisualFacts:true,
      uncertaintyMustBeVisible:true,
      noInventedDiagnosis:true,
      noInventedAction:true,
      neverEndAtIDontKnow:true,
    },
  };
}

export function renderExplanationActionText(contract,{language='zh-CN'}={}){
  if(language!=='zh-CN')return renderPlain(contract);
  const sections=[];
  pushSection(sections,'我看到了什么',contract.observed?.items,formatObserved);
  pushSection(sections,'你告诉了我什么',contract.userReported?.items,x=>x.text||`${x.type}: ${x.value??''}`);
  pushSection(sections,'我的判断',contract.assessment?.items,x=>`${confidencePrefix(x.confidence)}${x.text}`);
  pushSection(sections,'你现在可以怎么做',contract.actions?.items,x=>x.instruction);
  pushSection(sections,'我还不能确认什么',contract.unknowns?.items,x=>x.label||x.id);
  if(contract.escalation?.needed){
    const items=[];
    if(contract.escalation.nextEvidence?.length)items.push(...contract.escalation.nextEvidence.map(x=>x.instruction));
    if(contract.escalation.helpMessage)items.push(contract.escalation.helpMessage);
    pushSection(sections,'如果还不能解决',items,x=>x);
  }
  return sections.join('\n\n')||'目前没有足够证据形成可靠解释。请补充更清晰的图片或描述你想解决的问题。';
}

export function buildTeacherExplanationPrompt(contract={}){
  return {
    task:'explain_and_help_without_blurring_evidence_boundaries',
    requiredOutput:['observed','user_reported','assessment','actions','unknowns','escalation'],
    rules:[
      'Do not present user-reported claims as visually observed facts.',
      'Do not present inference as confirmed fact.',
      'Keep uncertainty visible.',
      'Give practical next steps only when supported.',
      'If evidence is insufficient, ask for the most useful next evidence or route to an appropriate tool/AI/human expert.',
      'Never revive superseded, retracted, expired, or conflicted evidence as a current fact.',
      'When current and historical facts differ, label them explicitly instead of merging them.',
      'Preserve provenance/evidence references for factual claims when they are available.',
    ],
    contract,
  };
}

function buildUserReported(mm){
  const out=[];
  for(const x of mm.symptoms??[])out.push({kind:'user_report',type:'symptom',value:x.type,text:x.sourceText??x.type,confidence:x.confidence??null,source:'speech_or_text'});
  for(const x of mm.attemptedActions??[])out.push({kind:'user_report',type:'attempted_action',value:x.type,text:x.sourceText??x.type,confidence:x.confidence??null,source:'speech_or_text'});
  for(const x of mm.temporalContext??[])out.push({kind:'user_report',type:'temporal',value:x.type,text:x.sourceText??x.type,confidence:x.confidence??null,source:'speech_or_text'});
  return dedupe(out,x=>`${x.type}|${x.value}|${x.text}`);
}
function buildInferences({problem,resolution}){
  const out=[];
  for(const f of problem.candidateFacts??[]){
    out.push({kind:'visual_candidate',text:`视觉模型候选：${f.value}`,confidence:Number(f.confidence??0),reason:f.providerId??f.source??'general_vision',status:'hypothesis'});
  }
  const intent=problem.intentHypotheses?.[0];
  if(intent)out.push({kind:'intent_hypothesis',text:intentText(intent.intent),confidence:intent.confidence??0,reason:intent.reason??null,status:'hypothesis'});
  for(const s of problem.problemSignals??[]){
    out.push({kind:'problem_signal',text:signalText(s.kind),confidence:signalConfidence(s),reason:s.kind,status:'inference'});
  }
  if(resolution.decision==='local_explain')out.push({kind:'resolution_assessment',text:'当前证据足以先做本地解释。',confidence:Number(problem.confidence?.observation??0),reason:'local_evidence_sufficient',status:'assessment'});
  if(resolution.decision==='need_more_evidence')out.push({kind:'resolution_assessment',text:'当前证据还不足以可靠确定结论，先补证据比继续猜更有效。',confidence:.95,reason:'need_more_evidence',status:'assessment'});
  if(resolution.decision==='teacher_or_tool')out.push({kind:'resolution_assessment',text:'当前本地证据不足以可靠完成解决方案，需要更合适的 AI、工具、资料或专家能力。',confidence:.95,reason:'teacher_or_tool',status:'assessment'});
  return out;
}
function buildActions({problem,resolution,unknowns}){
  const out=[];
  for(const x of resolution.nextEvidence??[])out.push({kind:'collect_evidence',priority:x.priority??1,instruction:x.instruction,reason:x.reason,supportedBy:'resolution_plan'});
  if(resolution.canOfferSolutionNow&&resolution.decision==='local_explain'){
    out.push({kind:'continue_local',priority:1,instruction:'可以先根据已确认事实继续解释；涉及未确认部分时保留不确定性。',reason:'local_resolution_possible',supportedBy:'resolution_plan'});
  }
  if(!out.length&&unknowns.length){
    out.push({kind:'clarify',priority:1,instruction:'补充最能直接确认未知项的照片、型号、错误代码或症状描述。',reason:'unresolved_evidence',supportedBy:'unknowns'});
  }
  return out.sort((a,b)=>a.priority-b.priority);
}
function buildEscalation({resolution,helpPath}){
  const e=resolution.escalation??{needed:false};
  return {
    needed:Boolean(e.needed),
    preferredKinds:e.preferredKinds??[],
    minimumNecessary:e.sendPolicy==='minimum_necessary',
    sendOriginalImage:Boolean(e.sendOriginalImage),
    nextEvidence:resolution.nextEvidence??[],
    helpKind:helpPath?.kind??null,
    helpMessage:helpPath?.message??fallbackHelp(e),
  };
}
function buildSafety({inferences,actions}){
  return {
    hasUnverifiedInference:inferences.some(x=>(x.confidence??0)<.8||x.status==='hypothesis'),
    actionCount:actions.length,
    requiresCaution:inferences.some(x=>(x.confidence??0)<.6),
  };
}
function classifyConfidence(observation,problem,inferences){
  const observationConfidence=Number(problem.confidence?.observation??observation.confidence?.overall??0);
  const assessmentConfidence=inferences.length?Math.min(...inferences.map(x=>Number(x.confidence??0))):observationConfidence;
  return {observation:observationConfidence,assessment:assessmentConfidence,label:assessmentConfidence>=.85?'high':assessmentConfidence>=.6?'medium':'low'};
}
function uniqueUnknowns(a){return dedupe(a,x=>x.id)}
function dedupe(a,key){const m=new Map();for(const x of a)if(!m.has(key(x)))m.set(key(x),x);return [...m.values()]}
function findObservation(o,kind){return (o?.observations??[]).find(x=>x.kind===kind)}
function formatObserved(x){const unit=x.unit?` ${x.unit}`:'';return `${x.label}: ${x.value}${unit}`}
function confidencePrefix(c){return c>=.85?'[较高把握] ':c>=.6?'[中等把握] ':'[低把握/推测] '}
function pushSection(out,title,items,fmt){if(items?.length)out.push(`${title}\n${items.map(x=>`- ${fmt(x)}`).join('\n')}`)}
function renderPlain(c){return JSON.stringify(c,null,2)}
function intentText(x){return ({troubleshoot:'你可能是在排查故障。',solve_or_guide:'你可能希望知道下一步怎么处理。',identify_and_explain:'你可能希望确认这是什么并得到解释。',explain_observation:'你可能希望了解图片中的内容。',translate:'你可能希望翻译图片或文字。'}[x]??`可能意图：${x}`)}
function signalText(x){return ({conflicting_evidence:'现有证据之间存在冲突。',insufficient_evidence:'当前证据不足。',cross_modal_conflict:'图片与语言证据之间存在需要核对的地方。'}[x]??`检测到问题信号：${x}`)}
function signalConfidence(s){return s.severity==='high'?.95:s.severity==='medium'?.85:.7}
function fallbackHelp(e){return e.needed?'优先使用能解决当前未决子问题的专业 AI/工具、官方资料或合适的真人专家。':null}

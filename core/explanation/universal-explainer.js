import {fuseMultimodalContext} from '../multimodal/multimodal-fusion.js';
import {understandProblem} from '../resolution/problem-understanding.js';
import {planResolution,recommendHelpPath} from '../resolution/resolution-router.js';
import {buildExplanationActionContract} from './explanation-action-contract.js';
import {createProblemSolvingSession,updateProblemSolvingSession,planUniversalNextActions,summarizeProblemState} from '../resolution/problem-solving-session.js';
import {analyzeEvidenceGaps,directEvidenceRequest} from '../resolution/evidence-request-intelligence.js';
import {classifyWorldDomain} from '../world/universal-world-router.js';
import {composeCapabilities} from '../world/capability-composition.js';
import {assessRealWorldRisk,enforceSafety,buildSafetyAuditRecord,commercialHandoff} from '../safety/real-world-safety-kernel.js';
import {understandUniversalIntent,planIntentResponse} from '../intent/universal-intent-router.js';
import {buildSpecialistHandoff,buildReferralPresentation} from '../intent/specialist-handoff.js';
import {planKnowledgeRetrieval,decideEscalationAfterRetrieval} from '../retrieval/knowledge-retrieval-router.js';
import {buildCurrentEntityFacts} from '../evidence/evidence-graph.js';
import {buildEvidenceAnswerContract} from '../answer/evidence-answer-contract.js';
import {buildExactProductIdentity} from '../entity/exact-product-identity.js';
import {formatMoneyMinor} from '../shared/money.js';

export function buildUniversalExplanation({observation={},speechText='',textInput='',conversation=[],availableTeachers=[],problemState=null,searchAvailable=false}={}){
  const mm=fuseMultimodalContext({visualObservation:observation,speechText,textInput,conversation});
  const userQuestion=String(speechText||textInput||'').trim();
  const canReusePerceptionAnalysis=!userQuestion&&observation?.problem&&observation?.resolution;
  const problem=canReusePerceptionAnalysis
    ? {...observation.problem,reused:true,reuseReason:'INITIAL_IMAGE_ANALYSIS_ALREADY_COMPUTED'}
    : understandProblem(observation,{userQuestion,multimodalContext:mm});
  const resolution=canReusePerceptionAnalysis
    ? {...observation.resolution,reused:true,reuseReason:'INITIAL_IMAGE_ANALYSIS_ALREADY_COMPUTED'}
    : planResolution({observation,problem,context:{multimodalContext:mm}});
  const helpPath=recommendHelpPath({problem,resolution,availableTeachers});
  const contract=buildExplanationActionContract({observation,problem,resolution,multimodal:mm,helpPath});
  const state=updateProblemSolvingSession(problemState??createProblemSolvingSession(),{problem,observation,userText:userQuestion});
  const factView=buildCurrentEntityFacts(state.evidenceGraph,state.evidenceGraph?.activeEntityId);
  state.factSnapshot=factView;
  const epistemicAnswer=buildEvidenceAnswerContract({explanationContract:contract,factView});
  const worldDomain=classifyWorldDomain({observation,problem});
  const intentGraph=understandUniversalIntent({text:userQuestion,observation,worldDomain});
  const capabilityPlan=composeCapabilities({worldDomain,intentGraph});
  const barcodeObservation=findObservation(observation,'barcode_qr');
  const exactProductIdentity=worldDomain.primary==='product'?buildExactProductIdentity({
    barcodeObservation,
    extractedText:observation.extractedText,
    visionIdentities:topVisionIdentities(observation),
    hints:{market:observation?.market??null},
  }):null;
  const evidenceAnalysis=analyzeEvidenceGaps({state,problem,observation});
  const evidenceRequest=directEvidenceRequest({analysis:evidenceAnalysis,state});
  const nextActionPlan=planUniversalNextActions({state,problem,resolution,helpPath,evidenceRequest,worldDomain});
  // Compatibility alias: older callers may still read `troubleshooting`. The
  // planner itself is now domain-neutral and only enters repair-specific logic
  // when the world router explicitly classifies the task as repair.
  const troubleshooting=nextActionPlan;
  state.proposedSteps=nextActionPlan.nextStep?[nextActionPlan.nextStep,...nextActionPlan.alternatives]:[];
  state.escalation=nextActionPlan.shouldEscalate?helpPath:null;
  const summary=composeSummary({observation,problem,resolution,mm});
  const highlights=composeHighlights({observation,problem,mm,state});
  const nextSteps=composeNextSteps({observation,problem,resolution,mm,helpPath,troubleshooting,state});
  const risk=assessRealWorldRisk({observation,problem,worldDomain,proposedActions:nextSteps});
  const intentPlan=planIntentResponse({intentGraph,worldDomain,safetyRisk:risk});
  const retrievalPlan=planKnowledgeRetrieval({observation,problem,worldDomain,intentGraph,safetyRisk:risk,localConfidence:contract.assessment?.confidence??observation.confidence?.overall,searchAvailable});
  const escalationPlan=decideEscalationAfterRetrieval({retrievalPlan,retrievalEvaluation:{canAnswer:false},intentGraph,safetyRisk:risk,specialistAdvantage:intentPlan.shouldRouteExternally});
  const draft={
    schemaVersion:2,
    kind:'universal_explanation',
    mode:detectMode(observation),
    summary,
    highlights,
    nextSteps,
    confidence:contract.assessment?.confidence??null,
    contract,
    multimodal:mm,
    problem,
    resolution,
    helpPath,
    problemState:state,
    problemStateSummary:summarizeProblemState(state),
    nextActionPlan,
    troubleshooting,
    worldDomain,
    intentGraph,
    capabilityPlan,
    exactProductIdentity,
    intentPlan,
    retrievalPlan,
    escalationPlan,
    evidenceAnalysis,
    evidenceRequest,
    factView,
    epistemicAnswer,
    mainlineCompression:{
      reusedPerceptionProblem:Boolean(problem?.reused),
      reusedPerceptionResolution:Boolean(resolution?.reused),
      reusedVisualPlan:Boolean(mm?.visualPlan?.reused),
      userQuestionPresent:Boolean(userQuestion),
    },
  };
  const safe=enforceSafety({risk,explanation:draft,problem,worldDomain});
  safe.safetyAudit=buildSafetyAuditRecord({risk,problem,worldDomain,safetyResult:safe});
  safe.specialistHandoff=buildSpecialistHandoff({intentPlan,intentGraph,worldDomain,problem,observation,safety:safe.safety,availableTeachers});
  safe.referral=buildReferralPresentation(safe.specialistHandoff);
  safe.commercialHandoff=commercialHandoff(safe);
  safe.voiceText=composeVoice({summary:safe.summary,highlights:safe.highlights,nextSteps:safe.nextSteps});
  return safe;
}

export function renderUniversalExplanationHtml(explanation,{escapeHtml=escapeDefault}={}){
  const h=[];
  if(explanation.summary)h.push(`<p class="explain-summary">${escapeHtml(explanation.summary)}</p>`);
  if(explanation.highlights?.length){
    h.push(`<div class="explain-highlights">${explanation.highlights.map(x=>`<div class="explain-item"><span>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.text)}</strong>${x.confidence!=null?`<small>${Math.round(x.confidence*100)}%</small>`:''}</div>`).join('')}</div>`);
  }
  if(explanation.safety?.message&&['R2','R3'].includes(explanation.safety?.risk?.level)){
    h.push(`<div class="safety-notice"><strong>安全提示 · ${escapeHtml(explanation.safety.risk.level)}</strong><p>${escapeHtml(explanation.safety.message)}</p>${explanation.safety.escalation?.category?`<small>建议帮助类型：${escapeHtml(explanation.safety.escalation.category)}</small>`:''}</div>`);
  }
  if(explanation.referral){
    const r=explanation.referral;
    h.push(`<div class="specialist-referral"><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.why)}</p><small>${escapeHtml(r.attribution)}</small></div>`);
  }
  if(explanation.evidenceRequest?.request){
    const r=explanation.evidenceRequest.request;
    h.push(`<div class="capture-request"><strong>${escapeHtml(r.title)}</strong><p>${escapeHtml(r.instruction)}</p>${r.why?`<small>为什么：${escapeHtml(r.why)}</small>`:''}${r.avoid?`<small>注意：${escapeHtml(r.avoid)}</small>`:''}</div>`);
  }
  if(explanation.epistemicAnswer?.conflicts?.length){
    h.push(`<div class="evidence-conflicts"><strong>存在冲突</strong><p>${escapeHtml(explanation.epistemicAnswer.conflicts.map(x=>x.text??x.issue??x.reason??'证据之间存在未解决冲突').join('；'))}</p></div>`);
  }
  if(explanation.epistemicAnswer?.historicalFacts?.length){
    const rows=explanation.epistemicAnswer.historicalFacts.slice(0,3).map(x=>`${x.type}: ${x.value}`).join('；');
    h.push(`<div class="evidence-history"><strong>历史信息</strong><p>${escapeHtml(rows)}</p></div>`);
  }
  if(explanation.nextSteps?.length){
    h.push(`<div class="explain-next"><strong>下一步</strong>${explanation.nextSteps.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div>`);
  }
  return h.join('');
}

function composeSummary({observation,problem,resolution,mm}){
  const receipt=findObservation(observation,'receipt_fields')?.receipt;
  const topIdentity=topVisionIdentity(observation);
  const scene=topVisionScene(observation);
  const text=String(observation.extractedText??'').trim();
  if(receipt&&isReliableReceipt(receipt)){
    const merchant=receipt.merchant?.value?String(receipt.merchant.value):'这张票据';
    const total=receipt.total?.value!=null?formatMoney(receipt.total.value):null;
    return total?`这是${merchant}的销售票据，可靠识别到总额约 ${total}。`:`这是${merchant}的销售票据，我已经提取到部分关键信息。`;
  }
  if(topIdentity){
    const base=topIdentity.status==='observed'
      ?`我看到的主要对象是 ${friendly(topIdentity.label)}。`
      :`视觉模型认为它可能是 ${friendly(topIdentity.label)}，但还需要保留不确定性。`;
    return scene?`${base} 场景看起来可能与${friendly(scene.label)}有关。`:base;
  }
  if(text.length>=8){
    const preview=text.replace(/\s+/g,' ').slice(0,80);
    return `这张图片里最明确的证据是文字内容：“${preview}${text.length>80?'…':''}”。`;
  }
  if(resolution.decision==='need_more_evidence')return '我已经检查了这张图片，但目前还没有足够证据可靠确认主体或问题。';
  if(mm.visual?.detectedType&&mm.visual.detectedType!=='unknown')return `我已经识别到这是一个 ${friendly(mm.visual.detectedType)} 类型的内容，但细节还需要继续确认。`;
  return '我已经看过这张图片，目前能提取的可靠信息还比较有限。';
}

function composeHighlights({observation,problem,mm,state}){
  const out=[];
  const rel=state?.lastPhotoRelationship;
  if(rel&&['same_object','probably_same_object'].includes(rel.status)&&state?.activeEntitySummary?.photoCount>1){
    out.push({label:'多图关系',text:`这张照片${rel.status==='same_object'?'与前面的照片属于同一对象':'很可能与前面的照片属于同一对象'}，目前已关联 ${state.activeEntitySummary.photoCount} 张证据照片。`,confidence:rel.confidence});
  }else if(rel?.status==='likely_new_object'){
    out.push({label:'多图关系',text:'这张照片很可能是另一个对象，我没有把它强行合并到前一个对象。',confidence:rel.confidence});
  }else if(rel?.status==='unresolved'){
    out.push({label:'多图关系',text:'我还不能确认这张照片是否属于前一个对象。',confidence:rel.confidence});
  }
  const receipt=findObservation(observation,'receipt_fields')?.receipt;
  if(receipt&&isReliableReceipt(receipt)){
    addReceipt(out,receipt);
    return out.slice(0,5);
  }
  for(const x of topVisionIdentities(observation).slice(0,3)){
    out.push({label:x.status==='observed'?'看到':'候选',text:friendly(x.label),confidence:x.confidence});
  }
  const scene=topVisionScene(observation);
  if(scene)out.push({label:'场景',text:friendly(scene.label),confidence:scene.confidence});
  const visualState=topVisionState(observation);
  if(visualState)out.push({label:'状态线索',text:friendly(visualState.label),confidence:visualState.confidence});
  const anomalies=generalVision(observation).flatMap(g=>g.anomalies??[]).sort((a,b)=>(b.confidence??0)-(a.confidence??0));
  if(anomalies[0])out.push({label:'异常线索',text:friendly(anomalies[0].label),confidence:anomalies[0].confidence});
  if(!out.length&&String(observation.extractedText??'').trim()){
    out.push({label:'文字',text:String(observation.extractedText).trim().replace(/\s+/g,' ').slice(0,120),confidence:findObservation(observation,'ocr')?.confidence??null});
  }
  for(const s of problem.symptoms??[])if(out.length<5)out.push({label:'你描述的症状',text:s.sourceText??friendly(s.type),confidence:s.confidence??null});
  return dedupe(out).slice(0,5);
}

function composeNextSteps({observation,problem,resolution,mm,helpPath,troubleshooting,state}){
  const out=[];
  if(state?.status==='resolved')return ['你已经确认问题解决。后续如果再次出现，可以从这次已确认的症状和处理记录继续。'];
  if(state?.lastPhotoRelationship?.status==='unresolved')out.push('请告诉我这张照片是不是同一台设备/同一个物体；在确认前我不会把两组证据合并。');
  if(troubleshooting?.nextStep?.text)out.push(troubleshooting.nextStep.text);
  const missing=mm.visualPlan?.route?.missingCapabilities??[];
  const modelPlan=findObservation(observation,'visual_autotune_policy');
  if(missing.includes('object_identity')||missing.includes('scene_context')){
    if(modelPlan?.heavyAllowed===false)out.push('这台设备更适合轻量识别；如果需要更强的物体/场景判断，可以让 Teacher 只处理这部分视觉问题。');
    else out.push('如果你希望进一步确认“这是什么”，可以准备本地通用视觉模型，或把未确认的视觉部分交给 Vision Teacher。');
  }
  for(const x of resolution.nextEvidence??[])if(x.instruction)out.push(x.instruction);
  if((problem.referencedObjects??[]).some(x=>x.requiresVisualGrounding))out.push('如果你说的是“这里/那个/右边这个”，请把目标拍得更清楚，或继续用一句话指出它的位置。');
  if(!String(problem.userQuestion??'').trim())out.push('你也可以直接对着图片说一句：想知道它是什么、什么意思、有什么值得注意，或者接下来应该怎么办。');
  if(resolution.escalation?.needed&&helpPath?.message)out.push(localizeHelp(helpPath));
  return [...new Set(out)].slice(0,3);
}

function composeVoice({summary,highlights,nextSteps}){
  const parts=[summary];
  const salient=(highlights??[]).slice(0,2).map(x=>`${x.label}是${x.text}`);
  parts.push(...salient);
  if(nextSteps?.[0])parts.push(nextSteps[0]);
  return parts.filter(Boolean).join(' ');
}

function detectMode(o){
  if(isReliableReceipt(findObservation(o,'receipt_fields')?.receipt))return 'document';
  if(topVisionIdentity(o))return 'general_vision';
  if(String(o.extractedText??'').trim())return 'text_image';
  return 'unknown_image';
}
function addReceipt(out,r){
  if(r.merchant?.value)out.push({label:'商户',text:String(r.merchant.value),confidence:r.merchant.confidence});
  if(r.date?.value)out.push({label:'日期',text:String(r.date.value),confidence:r.date.confidence});
  if(r.subtotal?.value!=null)out.push({label:'SUBTOTAL',text:formatMoney(r.subtotal.value),confidence:r.subtotal.confidence});
  if(r.tax?.value!=null)out.push({label:'IVA',text:formatMoney(r.tax.value),confidence:r.tax.confidence});
  if(r.total?.value!=null)out.push({label:'TOTAL',text:formatMoney(r.total.value),confidence:r.total.confidence});
}
function isReliableReceipt(r){return Boolean(r&&(r.total?.value!=null||r.merchant?.value||r.date?.value))}
function topVisionIdentities(o){return generalVision(o).flatMap(g=>(g.identity??[]).map(x=>({...x,providerId:g.providerId}))).filter(x=>x.label).sort((a,b)=>(b.confidence??0)-(a.confidence??0))}
function topVisionIdentity(o){return topVisionIdentities(o)[0]??null}
function topVisionScene(o){return generalVision(o).flatMap(g=>g.scene??[]).filter(x=>x.label).sort((a,b)=>(b.confidence??0)-(a.confidence??0))[0]??null}
function topVisionState(o){return generalVision(o).flatMap(g=>g.states??[]).filter(x=>x.label).sort((a,b)=>(b.confidence??0)-(a.confidence??0))[0]??null}
function generalVision(o){return (o?.observations??[]).filter(x=>x.kind==='general_vision')}
function findObservation(o,kind){return (o?.observations??[]).find(x=>x.kind===kind)}
function formatMoney(v,{locale=null,currency='XXX'}={}){return formatMoneyMinor(v,{locale,currency})}
function friendly(x){return String(x??'').replace(/_/g,' ').replace(/\broad or street\b/i,'道路/街景').replace(/\bworkspace\b/i,'工作区').replace(/\bliving room\b/i,'客厅').replace(/\bbedroom\b/i,'卧室').replace(/\bbathroom\b/i,'卫生间').replace(/\bkitchen\b/i,'厨房')}
function localizeHelp(h){if(h.kind==='teacher')return '如果本地证据仍不足，可以只把未解决的部分交给合适的 Teacher。';if(h.kind==='human_or_specialist_tool')return '如果仍无法确认原因，优先查官方说明书/诊断工具，必要时找对应专业人员。';return '如果仍无法确认，可以继续使用专业 AI、权威资料或对应领域专家处理未解决部分。'}
function dedupe(a){const seen=new Set();return a.filter(x=>{const k=`${x.label}|${x.text}`;if(seen.has(k))return false;seen.add(k);return true})}
function escapeDefault(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

import {observeImage} from '../../../providers/local/local-student.js';
import {createProgressiveResponse,firstUsefulMessage} from '../../../core/performance/progressive-response.js';
import {createRuntimeWarmup} from '../../../core/performance/runtime-warmup.js';
import {createTask} from '../../../core/task/task.js';
import {compileTaskPackage} from '../../../core/compiler/task-package-compiler.js';
import {WebSpeechRecognizer,WebSpeechSynthesizer} from '../../../providers/local/web-speech.js';
import {VoiceEngineRegistry} from '../../../core/voice/voice-engine-registry.js';
import {routeVoiceEngines} from '../../../core/voice/voice-adaptive-router.js';
import {VoicePerformanceStore} from '../../../core/voice/voice-performance.js';
import {rescoreSpeechAlternatives} from '../../../core/voice/voice-context-rescorer.js';
import {executeVoiceRecognition} from '../../../core/voice/voice-recognition-executor.js';
import {resolveVoiceTurn} from '../../../core/voice/voice-turn-continuity.js';
import {replaceObservationKinds} from '../../../core/observation/observation-state.js';
import {createConversationSession,attachObservation,addTurn} from '../../../core/session/conversation-session.js';
import {DemoTeacherProvider} from '../../../providers/local/demo-teacher.js';
import {discoverGatewayTeachers,gatewayUrlFromLocation} from '../../../providers/gateway/gateway-discovery.js';
import {prepareVisionAttachment} from '../../../features/capture/vision-attachment.js';
import {createPreparedImageSource} from '../../../features/capture/prepared-image-source.js';
import {applyFreshnessToTask} from '../../../core/freshness/freshness-engine.js';
import {HttpGatewaySearchProvider} from '../../../providers/gateway/http-gateway-search.js';
import {HttpPaddleOcrEngine} from '../../../providers/gateway/http-paddle-ocr.js';
import {TesseractOcrEngine} from '../../../providers/local/tesseract-ocr.js';
import {getVerifiedEntity,setVerifiedEntity} from '../../../core/entity/entity-session.js';
import {LocalStorageTaskStateStore} from '../../../core/persistence/task-state-store.js';
import {loadExecution} from '../../../core/persistence/persistent-execution.js';
import {DurableAuditLog,LocalStorageAuditEventStore,MemoryAuditEventStore} from '../../../core/audit/durable-event-log.js';
import {buildMultimodalProblemPrompt} from '../../../core/multimodal/multimodal-fusion.js';
import {buildExplanationActionContract,renderExplanationActionText,buildTeacherExplanationPrompt} from '../../../core/explanation/explanation-action-contract.js';
import {registerModelCacheServiceWorker} from '../../../core/models/model-asset-store.js';
import {ModelManager} from '../../../core/models/model-manager.js';
import {createDefaultModelCatalog} from '../../../core/models/default-model-catalog.js';
import {createDefaultVisualProviders} from '../../../providers/local/vision/default-visual-providers.js';
import {detectDeviceProfile} from '../../../core/device/device-profile.js';
import {buildUniversalExplanation,renderUniversalExplanationHtml} from '../../../core/explanation/universal-explainer.js';
import {orchestrate,routePresentation,authorizeUserRouteRequest} from '../../../core/orchestration/unified-orchestrator.js';
import {assessRuntimePerception,convergeProblemRuntime} from './runtime/runtime-convergence.js';
import {ExecutionDispatcher,runOrchestrationLoop} from '../../../core/orchestration/execution-dispatcher.js';
import {buildOrchestrationContext} from '../../../core/orchestration/orchestration-context.js';
import {runBrainMainline} from '../../../core/brain/brain-mainline.js';
import {auditMainlineFlow} from '../../../core/brain/mainline-e2e-audit.js';
import {verifyExecutionResult} from '../../../core/verification/verification-core.js';
import {createWebCapabilityExecutors} from './runtime/web-capability-executors.js';
import {resolveGlobalContext} from '../../../core/global/global-context.js';
import {getLocaleProfile} from '../../../core/global/locale-profile.js';
import {LabResultStore} from '../../../core/perception/lab/lab-result-store.js';
import {deviceKeyFor} from '../../../core/perception/perception-engine-selector.js';
import {buildRuntimeEvidencePolicy} from '../../../core/perception/runtime-evidence-policy.js';
import {buildScenarioEvidence,detectRuntimeScenarios} from '../../../core/perception/scenario-evidence-policy.js';
import {OutcomeFeedbackStore,buildOutcomeValidation} from '../../../core/perception/outcome-feedback.js';

const $=s=>document.querySelector(s);
const labResults=new LabResultStore();
const outcomeFeedback=new OutcomeFeedbackStore();

const file=$('#file'),eye=$('#eye'),mic=$('#mic'),status=$('#status'),result=$('#result'),preview=$('#preview'),fields=$('#fields'),universalAnswer=$('#universalAnswer'),newProblem=$('#newProblem'),rawText=$('#rawText'),progress=$('#progress'),progressBar=$('#progress span'),teacher=$('#teacher'),again=$('#again'),notice=$('#notice'),routeBadge=$('#routeBadge'),question=$('#question'),ask=$('#ask'),conversation=$('#conversation'),speechHint=$('#speechHint'),speak=$('#speak'),modelManagerButton=$('#modelManagerButton'),modelManagerPanel=$('#modelManagerPanel'),modelManagerClose=$('#modelManagerClose'),modelList=$('#modelList'),modelStorage=$('#modelStorage');
const voicePerformance=new VoicePerformanceStore();
const voiceRegistry=new VoiceEngineRegistry([new WebSpeechRecognizer()]);
let recognizer=voiceRegistry.supported()[0]??new WebSpeechRecognizer();
const synthesizer=new WebSpeechSynthesizer();
let teacherProviders=location.search.includes('demoTeacher=1')?[new DemoTeacherProvider()]:[];
const gatewayUrl=gatewayUrlFromLocation(location);
const searchProvider=gatewayUrl?new HttpGatewaySearchProvider({gatewayUrl}):null;
const ocrEngines=gatewayUrl?[new HttpPaddleOcrEngine({gatewayUrl}),new TesseractOcrEngine()]:[new TesseractOcrEngine()];
const taskStateStore=safeTaskStateStore();
const modelManager=new ModelManager({catalog:createDefaultModelCatalog()});
const currentDeviceProfile=detectDeviceProfile();
const runtimeWarmup=createRuntimeWarmup({deviceProfile:currentDeviceProfile});
const auditLog=safeAuditLog();
if(gatewayUrl){discoverGatewayTeachers(gatewayUrl).then(found=>{teacherProviders=[...teacherProviders,...found];if(found.length)showNotice(`已连接 ${found.length} 位老师。`)}).catch(error=>{console.warn('Gateway discovery failed',error);showNotice('老师网关暂时不可用，本地看见功能仍可使用。')});}
let currentUrl=null,currentPackage=null,currentObservation=null,currentVisionAttachment=null,lastAnswer='',currentUniversalExplanation=null,currentProblemState=null,session=createConversationSession(),listening=false,pendingExecution=null,pendingVoiceFeedback=null,currentGlobalContext=resolveGlobalContext({userEnvironment:detectUserEnvironment()}),imageRunSeq=0,imageRunController=null;

eye.addEventListener('click',()=>file.click()); again.addEventListener('click',()=>file.click());
newProblem?.addEventListener('click',()=>{currentProblemState=null;session=createConversationSession();currentObservation=null;currentPackage=null;currentVisionAttachment=null;resetResult();result.hidden=true;status.textContent='等待发现';showNotice('已开始一个新问题。')});
mic.addEventListener('click',()=>listening?recognizer.stop():listen());
ask.addEventListener('click',()=>submitQuestion(question.value,{modality:'text'})); question.addEventListener('keydown',e=>{if(e.key==='Enter')submitQuestion(question.value,{modality:'text'})});
speak.addEventListener('click',()=>lastAnswer&&synthesizer.speak(lastAnswer,{language:currentGlobalContext.language??navigator.language??'auto'}).catch(()=>showNotice('当前浏览器无法朗读。')));
teacher.addEventListener('click',()=>dispatchManualTeacher());
restorePendingTaskNotice();
registerModelCacheServiceWorker().catch(error=>console.warn('Model cache service worker unavailable',error));
modelManagerButton?.addEventListener('click',async()=>{modelManagerPanel.hidden=false;await renderModelManager()});
modelManagerClose?.addEventListener('click',()=>{modelManagerPanel.hidden=true});
modelManager.subscribe(()=>renderModelManager().catch(()=>{}));
// Idle warmup is runtime-only: no model downloads, no recognition, no heavy model preloading.
const localTesseract=ocrEngines.find(x=>x?.id==='tesseract-js');
if(localTesseract?.warmup)runtimeWarmup.schedule('tesseract-runtime',()=>localTesseract.warmup(),{cost:'light',reason:'app_idle'});

const pilotLabButton=$('#pilotLabButton');
let pilotLabRuntime=null,pilotLabLoading=null;
pilotLabButton?.addEventListener('click',async()=>{
 try{
  if(!pilotLabRuntime){
   pilotLabLoading??=import('./runtime/pilot-lab-runtime.js').then(({setupPilotLabRuntime})=>setupPilotLabRuntime({
    storage:safeLocalStorage(),labResults,currentDeviceProfile,voiceRegistry,ocrEngines,
    buildApprovedVisualProviders,formatBytes,escapeHtml,
   }));
   pilotLabRuntime=await pilotLabLoading;
  }
  pilotLabRuntime.open();
 }catch(error){
  console.error('Pilot Lab failed to load',error);
  showNotice('实验室模块暂时无法加载；正常识别、语音与老师功能不受影响。');
 }
});

function getRuntimeEvidencePolicy(modality,language='auto'){
 const deviceKey=deviceKeyFor(currentDeviceProfile);
 return buildRuntimeEvidencePolicy({labResults:labResults.list({modality,deviceKey}),modality,deviceKey,language});
}

function getScenarioEvidencePolicy(modality,{triage=null,userQuestion='',language='auto',hints={},scenarios=null}={}){
 const deviceKey=deviceKeyFor(currentDeviceProfile);
 const active=scenarios??detectRuntimeScenarios({modality,triage,userQuestion,language,hints});
 return buildScenarioEvidence({labResults:labResults.list({modality,deviceKey}),modality,deviceKey,scenarios:active});
}

function getOutcomeValidationPolicy(modality,{scenarios=[]}={}){
 const deviceKey=deviceKeyFor(currentDeviceProfile);
 return buildOutcomeValidation({rows:outcomeFeedback.list({modality,deviceKey}),modality,deviceKey,scenarios});
}
function normalizeFeedbackText(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}

function safeLocalStorage(){try{const k='__seemind_lab_probe__';localStorage.setItem(k,'1');localStorage.removeItem(k);return localStorage}catch{return null}}

async function buildApprovedVisualProviders() {
  // 如果模型已经在内存中，直接使用
  if (window.__detector) {
    console.log('🧠 使用内存中的 DETR 模型');
    return [
      {
        id: 'detr-injected',
        getProfile: () => ({
          capabilities: [
            { capability: 'object_identity', score: 0.85 },
            { capability: 'scene_context', score: 0.60 }
          ],
          priority: 100,
          deviceClasses: ['balanced', 'performance'],
          estimatedMemoryMb: 220,
          estimatedLatencyMs: 2000,
          privacyModes: ['local'],
          reliability: 0.9
        }),
        analyze: async (image, { capabilities = [] } = {}) => {
          console.log('🧠 DETR 分析图片...');
          const previewEl = document.querySelector('#preview');
          if (!previewEl || !previewEl.src) {
            return { identity: [], scene: [], regions: [], confidence: 0 };
          }
          try {
            const result = await window.__detector(previewEl.src, { threshold: 0.5 });
            console.log('DETR 结果:', result);
            if (result && result.length > 0) {
              const labels = result.map(d => d.label);
              const uniqueLabels = labels.filter((v, i) => labels.indexOf(v) === i);
              return {
                identity: uniqueLabels.map(label => ({
                  label: label,
                  confidence: result.find(d => d.label === label)?.score || 0.8,
                  status: 'observed'
                })),
                scene: [],
                regions: result.map((d, i) => ({
                  id: `detected-${i}`,
                  regionType: 'object',
                  objectType: d.label,
                  confidence: d.score,
                  bbox: { x: d.box.xmin, y: d.box.ymin, width: d.box.xmax - d.box.xmin, height: d.box.ymax - d.box.ymin }
                })),
                confidence: result.length > 0 ? Math.max(...result.map(d => d.score)) : 0
              };
            }
          } catch (error) {
            console.error('DETR 分析失败:', error.message);
          }
          return { identity: [], scene: [], regions: [], confidence: 0 };
        },
        load: async () => {},
        unload: async () => {}
      }
    ];
  }

  // 原有逻辑（当模型未加载时）
  const item = modelManager.get('general-vision-detr');
  return createDefaultVisualProviders({
    enableGeneralVision: true,
    detrOptions: {
      modelDeliveryManager: modelManager.deliveryManager,
      modelManifest: item?.manifest || null,
      offlineOnly: globalThis.navigator?.onLine === false,
      modelStorageBudgetBytes: Math.max(item?.estimatedDownloadBytes * 1.2 || 64 * 1024 * 1024, 64 * 1024 * 1024),
      onModelProgress: (e) => {
        if (e?.type === 'model_file_progress' && e.total) {
          const pct = Math.min(100, Math.round(e.loaded / e.total * 100));
          const statusEl = document.querySelector('#status');
          if (statusEl) {
            statusEl.textContent = `正在准备视觉模型：${pct}%`;
          }
        }
        if (e?.type === 'model_load_complete') {
          const statusEl = document.querySelector('#status');
          if (statusEl) {
            statusEl.textContent = '视觉模型已准备就绪';
          }
          const fileInput = document.querySelector('#file');
          if (fileInput?.files?.length) {
            showNotice('视觉模型已准备，正在重新识别...');
            setTimeout(() => {
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }, 500);
          }
        }
        if (e?.type === 'model_load_failed') {
          showNotice(e.message || '视觉模型加载失败，将使用基础视觉能力');
        }
      },
      loadTimeoutMs: 60000,
    },
  });
}

const capabilityExecutors=createWebCapabilityExecutors({
  getTaskPackage:()=>currentPackage,
  setTaskPackage:v=>{currentPackage=v},
  getObservation:()=>currentObservation,
  getVisionAttachment:()=>currentVisionAttachment,
  getConversation:()=>session.turns,
  getProviders:()=>teacherProviders,
  getSearchProvider:()=>searchProvider,
  getVerifiedEntity:()=>getVerifiedEntity(session),
  setVerifiedEntity:v=>setVerifiedEntity(session,v),
  getPendingExecution:()=>pendingExecution,
  setPendingExecution:v=>{pendingExecution=v},
  taskStateStore,
  auditLog,
  requestConsent:async({message})=>confirm(message),
  onPlannerEvent:event=>console.info('Planner Event',event),
});
const executionDispatcher=new ExecutionDispatcher({audit:auditLog,executors:capabilityExecutors});


async function dispatchManualTeacher(){
  if(!currentPackage)return;
  const context=buildOrchestrationContext({task:currentPackage.task,observation:currentObservation,explanation:currentUniversalExplanation,capabilities:{teacherCount:teacherProviders.length,searchAvailable:Boolean(searchProvider),plannerAvailable:true},taskPackage:currentPackage});
  const contract=authorizeUserRouteRequest({route:'TEACHER',context,reason:'user_explicit_teacher_request',details:{action:'send_minimum_necessary_task_package_then_reenter'}});
  const flowed=await runApprovedFlow({initialContext:context,firstContract:contract});
  presentFlowOutcome(flowed);
}

async function runApprovedFlow({initialContext,firstContract=null}={}){
 let usedFirst=false;
 const decide=({context})=>{
   if(firstContract&&!usedFirst){usedFirst=true;return firstContract}
   return orchestrate({context});
 };
 const flow=await runOrchestrationLoop({
   initialContext,
   decide,
   dispatcher:executionDispatcher,
   verify:verifyExecutionResult,
   maxTransitions:6,
   routeBudget:{maxExternalCalls:3,maxSameRoute:2},
   onTransition:event=>console.info('Mainline',event.type,event.contract?.route??'',event.verification?.status??''),
 });
 const e2eAudit=auditMainlineFlow({flow,problemState:currentProblemState,observation:currentObservation});
 if(!e2eAudit.healthy||e2eAudit.issues.length)console.warn('Mainline E2E Audit',e2eAudit);
 auditLog?.record?.('mainline_e2e_audit',{healthy:e2eAudit.healthy,issues:e2eAudit.issues,metrics:e2eAudit.metrics});
 return {...flow,e2eAudit};
}

async function dispatchAutomaticRoute({decision,task,universal}){
 const initial=buildOrchestrationContext({task,observation:currentObservation,explanation:universal,capabilities:{teacherCount:teacherProviders.length,searchAvailable:Boolean(searchProvider),plannerAvailable:true},taskPackage:currentPackage});
 return runApprovedFlow({initialContext:initial,firstContract:decision});
}

function presentFlowOutcome(flowed){
 const finalContract=flowed?.contract??flowed?.transitions?.at?.(-1)?.contract??null;
 const finalExecution=flowed?.execution??flowed?.transitions?.at?.(-1)?.execution??null;
 if(finalExecution?.taskPackage)currentPackage=finalExecution.taskPackage;
 if(!finalContract)return;
 const ui=routePresentation(finalContract);
 routeBadge.textContent=ui.label;routeBadge.dataset.route=ui.kind;teacher.hidden=!ui.showTeacher||!teacherProviders.length;
 const verified=flowed?.context?.verification?.verdict??null;
 if(flowed.status==='max_transitions')showNotice('处理已达到最大步骤预算，系统已停止继续调用。');
 else if(flowed.status==='route_budget_exhausted')showNotice('外部调用已达到本次问题预算，系统已停止继续重复搜索/老师调用。');
 else if(verified&&!verified.accepted)showNotice(verified.status==='CONFLICT'?'可靠来源存在冲突，我不会把它们强行合并成一个答案。':'执行结果没有通过验证，系统已按证据边界停止或改走下一条路径。');
 else if(finalContract.route==='STOP')showNotice('当前证据或能力仍不足，系统已停止继续调用而不是猜测。');
 else if(finalContract.route==='HUMAN')showNotice('安全或专业边界要求由合适的专业人员继续处理。');

 // Only a verified/re-entered terminal result may become a new assistant answer.
 const teacherState=flowed?.context?.external?.teacherState;
 const plannerState=flowed?.context?.planning?.plannerState;
 const candidate=teacherState?.answer?.answer??teacherState?.answer??plannerState?.resultValue?.answer??plannerState?.resultValue?.conclusion??null;
 if(candidate&&verified?.accepted){
   lastAnswer=String(candidate);
   addTurn(session,{role:'assistant',text:lastAnswer,modality:'text'});
   renderConversation();
 }
}

file.addEventListener('change',async()=>{
 const f=file.files?.[0]; if(!f)return; imageRunController?.abort(); const controller=new AbortController(); imageRunController=controller; const runId=++imageRunSeq,isActive=()=>runId===imageRunSeq&&!controller.signal.aborted; const captureQuestion=String(question?.value??'').trim(); resetResult();
 currentUrl&&URL.revokeObjectURL(currentUrl); currentUrl=URL.createObjectURL(f); preview.src=currentUrl; result.hidden=false; status.textContent='正在看…'; progress.hidden=false; progressBar.style.width='3%';
 try{
  const visualProviders=await buildApprovedVisualProviders();
  const preparedSource=await createPreparedImageSource(f,{signal:controller.signal}).catch(error=>{console.warn('Shared image decode unavailable; falling back to independent paths',error);return null});
  let sourceConsumers=preparedSource?2:0,firstUsefulCommitted=false;
  const progressive=createProgressiveResponse({startedAt:Date.now()});
  progressive.emit('received');
  const releasePreparedSource=()=>{if(!preparedSource||sourceConsumers<=0)return;sourceConsumers--;if(sourceConsumers===0)preparedSource.close()};
  const commitFirstUseful=({triage,elapsedMs})=>{
    if(!isActive()||firstUsefulCommitted)return;firstUsefulCommitted=true;
    const event=progressive.emit('first_useful',{message:firstUsefulMessage(triage),useful:true,meta:{route:triage?.primaryRoute??null}});
    status.textContent=event?.message??firstUsefulMessage(triage);
    progressBar.style.width='28%';result.dataset.firstUsefulMs=String(elapsedMs??event?.firstUsefulMs??'');
  };
  let obs,vision;
  try{
    [obs,vision]=await Promise.all([
      observeImage(f,{ocrEngines,userQuestion:captureQuestion,ocrLanguage:'auto',signal:controller.signal,onProgress:m=>{if(isActive())updateProgress(m)},onFirstUseful:commitFirstUseful,preparedSource,onPreparedSourceConsumed:releasePreparedSource,visualProviders,runtimeEvidence:getRuntimeEvidencePolicy('vision'),scenarioEvidenceBuilder:scenarios=>getScenarioEvidencePolicy('vision',{scenarios}),outcomeValidationBuilder:scenarios=>getOutcomeValidationPolicy('vision',{scenarios}),outcomeStore:outcomeFeedback}),
      prepareVisionAttachment(f,{preparedSource,onPreparedSourceConsumed:releasePreparedSource}).catch(error=>{console.warn('Vision preparation failed',error);return null}),
    ]);
  }finally{if(preparedSource&&sourceConsumers>0){sourceConsumers=0;preparedSource.close()}}
  if(!isActive())return;
  currentObservation=obs; currentVisionAttachment=vision;
  const perceptionRuntime=assessRuntimePerception(obs);
  obs.observations?.push?.({kind:'perception_quality_runtime',...perceptionRuntime});
  attachObservation(session,obs);
  const receipt=obs.observations.find(x=>x.kind==='receipt_fields')?.receipt;
  currentUniversalExplanation=buildUniversalExplanation({
    observation:obs,
    textInput:captureQuestion,
    conversation:session.turns,
    availableTeachers:teacherProviders.map(x=>x.id??x.providerId??'teacher'),
    problemState:currentProblemState,
    searchAvailable:Boolean(searchProvider),
  });
  currentProblemState=currentUniversalExplanation.problemState;
  const isDocument=currentUniversalExplanation.mode==='document';
  const task=createTask({
    type:isDocument?'receipt_parse':'image_explain',
    userIntent:captureQuestion||(isDocument?'识别并理解这张票据':'看懂并解释这张图片'),
    requiredCapabilities:isDocument?['ocr']:['vision','reasoning'],
    imageRequired:true,
    language:currentGlobalContext.language??'auto',
    locale:currentGlobalContext.locale,
    userRegion:currentGlobalContext.userRegion,
    questionRegion:currentGlobalContext.questionRegion,
    objectRegion:currentGlobalContext.objectRegion,
    jurisdiction:currentGlobalContext.jurisdiction,
    currency:currentGlobalContext.currency,
    measurementSystem:currentGlobalContext.measurementSystem,
    timezone:currentGlobalContext.timezone,
  });
  currentGlobalContext=resolveGlobalContext({task,observation:obs,entity:getVerifiedEntity(session),userEnvironment:detectUserEnvironment(),conversation:session.turns});
  Object.assign(task,{
    language:currentGlobalContext.language??task.language,
    locale:currentGlobalContext.locale??task.locale,
    userRegion:currentGlobalContext.userRegion,
    questionRegion:currentGlobalContext.questionRegion,
    objectRegion:currentGlobalContext.objectRegion,
    jurisdiction:currentGlobalContext.jurisdiction,
    currency:currentGlobalContext.currency,
    measurementSystem:currentGlobalContext.measurementSystem,
    timezone:currentGlobalContext.timezone,
    globalContext:currentGlobalContext,
  });
  const capabilities={teacherCount:teacherProviders.length,searchAvailable:Boolean(searchProvider),plannerAvailable:true};
  const brain=runBrainMainline({task,observation:obs,explanation:currentUniversalExplanation,capabilities});
  const decision=brain.decision;
  currentPackage=compileTaskPackage({task,observation:obs,receipt,conversation:session.turns,entityCandidates:[getVerifiedEntity(session)].filter(Boolean),problemState:brain.context.understanding.problemState,answerability:brain.answerability});
  renderInitialExplanation(currentUniversalExplanation,receipt,decision);
  rawText.textContent=obs.extractedText||'未识别到文字';
  const finalProgress=progressive.emit('complete',{message:currentUniversalExplanation.resolution?.canExplainNow?'已经理解并整理当前证据。':'已经完成当前处理，但还需要更多证据。'});
  status.textContent=finalProgress.message;
  result.dataset.totalPerceptionMs=String(finalProgress.elapsedMs);
 }catch(error){
  if(!isActive())return;
  status.textContent='本地处理没有完成';
  showNotice(`${humanizeError(error)}。可以重拍/换一张图片再试；系统不会把本机执行错误自动当成“需要老师”。`);
  teacher.hidden=true;
  routeBadge.textContent='请重试';
  routeBadge.dataset.route='clarify';
  console.error(error);
 }
 finally{if(runId===imageRunSeq){if(imageRunController===controller)imageRunController=null;progress.hidden=true;progressBar.style.width='0%';file.value=''}}
});

async function listen(){
 if(!voiceRegistry.supported().length){speechHint.hidden=false;speechHint.textContent='当前没有可用语音识别引擎。你仍可输入问题。';question.focus();return}
 listening=true;mic.classList.add('listening');mic.textContent='正在听…';speechHint.hidden=false;speechHint.textContent='说吧，我在听。';
 try{
   pendingVoiceFeedback=null;
   const voiceLanguage=currentGlobalContext.language??navigator.language??'auto';
   const voiceScenarioEvidence=getScenarioEvidencePolicy('voice',{userQuestion:question.value,language:voiceLanguage});
   const voiceOutcomeValidation=getOutcomeValidationPolicy('voice',{scenarios:voiceScenarioEvidence.scenarios});
   const route=routeVoiceEngines({engines:voiceRegistry.supported(),language:voiceLanguage,deviceProfile:currentDeviceProfile,performanceStore:voicePerformance,runtimeEvidence:getRuntimeEvidencePolicy('voice',voiceLanguage),scenarioEvidence:voiceScenarioEvidence,outcomeValidation:voiceOutcomeValidation});
   const execution=await executeVoiceRecognition({
     route,performanceStore:voicePerformance,totalBudgetMs:3500,perEngineTimeoutMs:2500,outcomeStore:outcomeFeedback,outcomeContext:{deviceKey:deviceKeyFor(currentDeviceProfile),scenarios:voiceScenarioEvidence.scenarios},
     listenOptions:{
       language:currentGlobalContext.language??navigator.language??'auto',continuous:false,maxAlternatives:3,
       onInterim:t=>{speechHint.textContent=t||'说吧，我在听。'},
     },
   });
   if(execution.status!=='completed')throw new Error(execution.reason??'VOICE_RECOGNITION_FAILED');
   recognizer=route.ranked.find(x=>x.engine.id===execution.engineId)?.engine??recognizer;
   const r=execution.result??{};
   const rescored=rescoreSpeechAlternatives({
     alternatives:(r.alternatives?.length?r.alternatives:[{text:r.text,confidence:1}]),
     observation:currentObservation,conversation:session.turns,language:currentGlobalContext.language??'auto'
   });
   let finalText=rescored.primary?.text??r.text;
   const previousUserText=[...session.turns].reverse().find(x=>x.role==='user')?.text??'';
   const voiceTurn=resolveVoiceTurn({text:finalText,previousUserText,observation:currentObservation});
   finalText=voiceTurn.resolvedText;
   if(finalText&&rescored.quality?.shouldClarify&&voiceTurn.type!=='correction'){
     const feedbackScenarios=detectRuntimeScenarios({modality:'voice',userQuestion:finalText,language:voiceLanguage});
     pendingVoiceFeedback={engineId:execution.engineId,deviceKey:deviceKeyFor(currentDeviceProfile),scenarios:feedbackScenarios,originalText:finalText};
     question.value=finalText;
     speechHint.textContent=`我听到：“${finalText}”。这次语音把握不够，请确认/修改后再发送。`;
     question.focus();
     return;
   }
   if(finalText){
     question.value=finalText;
     if(voiceTurn.type==='correction')speechHint.textContent=`已按你的明确更正理解为：“${finalText}”。`;
     await submitQuestion(finalText,{modality:'speech'});
   }
 }catch(e){
   if(!/aborted/i.test(String(e.message)))speechHint.textContent='这次没有听清，系统已尝试可用语音引擎。你可以再说一次或直接输入。';
 }finally{listening=false;mic.classList.remove('listening');mic.textContent='说一说'}
}

async function submitQuestion(text,{modality='text'}={}){
 text=String(text||'').trim();if(!text)return; if(!currentObservation){speechHint.hidden=false;speechHint.textContent='先让我看一样东西，再对着它问我。';return}
 if(modality==='text'&&pendingVoiceFeedback){
   const confirmed=normalizeFeedbackText(text)===normalizeFeedbackText(pendingVoiceFeedback.originalText);
   outcomeFeedback.record({modality:'voice',engineId:pendingVoiceFeedback.engineId,deviceKey:pendingVoiceFeedback.deviceKey,scenarios:pendingVoiceFeedback.scenarios,kind:'quality',outcome:confirmed?'confirmed':'corrected',meta:{originalText:pendingVoiceFeedback.originalText,submittedText:text}});
   pendingVoiceFeedback=null;
 }
 addTurn(session,{role:'user',text,modality}); question.value=''; renderConversation();
 const universal=buildUniversalExplanation({
   observation:currentObservation,
   speechText:modality==='speech'?text:'',
   textInput:modality==='speech'?'':text,
   conversation:session.turns,
   availableTeachers:teacherProviders.map(x=>x.id??x.providerId??'teacher'),
   problemState:currentProblemState,
   searchAvailable:Boolean(searchProvider),
 });
 currentProblemState=universal.problemState;
 currentUniversalExplanation=universal;
 universalAnswer.hidden=false;universalAnswer.innerHTML=renderUniversalExplanationHtml(universal,{escapeHtml});
 const mm=universal.multimodal;
 const problem=universal.problem;
 const resolution=universal.resolution;
 const helpPath=universal.helpPath;
 const explanation=universal.contract;
 replaceObservationKinds(currentObservation,{
   multimodal_context:mm,
   multimodal_problem_prompt:buildMultimodalProblemPrompt(mm),
   problem_understanding:{schemaVersion:2,...problem,multimodal:true},
   resolution_plan:{schemaVersion:2,...resolution,multimodal:true},
   explanation_action_contract:explanation,
   teacher_explanation_prompt:buildTeacherExplanationPrompt(explanation),
 });
 currentObservation.problem=problem;currentObservation.resolution=resolution;currentObservation.explanation=explanation;
 let task=createTask({type:'question_about_observation',userIntent:text,requiredCapabilities:currentVisionAttachment?['reasoning','vision']:['reasoning'],imageRequired:Boolean(currentVisionAttachment)});task=applyFreshnessToTask(task);
 const capabilities={teacherCount:teacherProviders.length,searchAvailable:Boolean(searchProvider),plannerAvailable:true};
 const brain=runBrainMainline({task,observation:currentObservation,explanation:universal,capabilities,taskPackage:currentPackage});
 const decision=brain.decision;
 const receipt=currentObservation.observations.find(x=>x.kind==='receipt_fields')?.receipt;
 currentPackage=compileTaskPackage({task,observation:currentObservation,receipt,userIntent:text,conversation:session.turns,entityCandidates:[getVerifiedEntity(session)].filter(Boolean),problemState:brain.context.understanding.problemState,answerability:brain.answerability});
 const runtimeConvergence=convergeProblemRuntime({task,universal,brain,verifiedEvidence:currentPackage.evidence??[]});
 currentObservation.observations?.push?.({kind:'runtime_convergence',...runtimeConvergence});
 currentProblemState={...currentProblemState,resolutionState:runtimeConvergence.resolution,runtimeConvergence};

 const routeUi=routePresentation(decision);
 routeBadge.textContent=currentPackage.identity?.required&&!currentPackage.identity?.ok?'先确认是什么':routeUi.label;
 routeBadge.dataset.route=routeUi.kind;
 teacher.hidden=!routeUi.showTeacher||!teacherProviders.length;
 const localExplanation=universal.voiceText||renderExplanationActionText(explanation);
 lastAnswer=localExplanation;
 addTurn(session,{role:'assistant',text:lastAnswer,modality:'text'});renderConversation();
 if(decision.route==='LOCAL')showNotice('已按证据边界生成解释与下一步。');
 else if(decision.route==='CLARIFY')showNotice('先补最有价值的一条证据，不急着调用老师或搜索。');
 else if(decision.route==='SEARCH')showNotice('当前最合适的下一步是查证公开资料；不会因为有老师就跳过检索。');
 else if(decision.route==='HUMAN')showNotice('安全优先：这一步建议交给合格专业人员，系统不继续给危险操作指令。');
 else if(decision.route==='STOP')showNotice('当前证据或外部能力不足；我先明确边界，不会假装知道。');
 else showNotice('我先告诉你当前能确认的内容；未决部分再交给合适的能力。');
 if(['SEARCH','TEACHER','PLAN'].includes(decision.route)){
   const flowed=await dispatchAutomaticRoute({decision,task,universal});
   presentFlowOutcome(flowed);
 }
 speak.hidden=!synthesizer.isSupported();
 if(synthesizer.isSupported()) speak.hidden=false;
 console.info('Teacher Task Package',currentPackage,decision);
}


function renderInitialExplanation(explanation,receipt,decision){
  const card=document.querySelector('.answer-card');
  if(card)card.dataset.mode=explanation.mode;
  universalAnswer.hidden=false;
  universalAnswer.innerHTML=renderUniversalExplanationHtml(explanation,{escapeHtml});
  document.querySelector('#answerTitle').textContent=explanation.mode==='document'?'票据解读':'图片解说';
  if(explanation.mode==='document')renderReceipt(receipt,decision);
  else{
    fields.innerHTML='';
    const ui=routePresentation(decision);
    routeBadge.textContent=ui.label;
    routeBadge.dataset.route=ui.kind;
    teacher.hidden=!ui.showTeacher||!teacherProviders.length;
  }
  lastAnswer=explanation.voiceText||'';
  speak.hidden=!lastAnswer||!synthesizer.isSupported();
}
function renderConversation(){conversation.hidden=session.turns.length===0;conversation.innerHTML=session.turns.slice(-6).map(t=>`<div class="turn ${t.role}">${escapeHtml(t.text)}</div>`).join('')}
function renderReceipt(r,decision){if(!r){showNotice('没有形成可靠的票据结构。');teacher.hidden=false;return}const rows=[['商户',r.merchant,formatText],['日期',r.date,formatText],['SUBTOTAL',r.subtotal,formatMoney],['IVA',r.tax,formatMoney],['TOTAL',r.total,formatMoney],['EFECTIVO',r.cash,formatMoney],['CAMBIO',r.change,formatMoney]];fields.innerHTML=rows.map(([l,f,fmt])=>fieldRow(l,f,fmt)).join('');const ui=routePresentation(decision);routeBadge.textContent=decision.route==='LOCAL'?'本地完成':ui.label;routeBadge.dataset.route=ui.kind;teacher.hidden=!ui.showTeacher||!teacherProviders.length;const conflicts=r.checks?.filter(c=>c.status==='conflicted')??[];if(conflicts.length){showNotice('票据金额存在矛盾，系统没有自动替你改数字。建议确认原图。');teacher.hidden=false}}
function fieldRow(label,f,fmt){const unresolved=f?.value==null,value=unresolved?'未识别':fmt(f.value),pct=Math.round((f?.confidence||0)*100);return `<div class="field ${unresolved?'unresolved':''}"><span>${label}</span><strong>${escapeHtml(value)}</strong><small>${unresolved?'':pct+'%'}</small></div>`}
function formatMoney(v) {
  const profile = getLocaleProfile(currentGlobalContext.questionRegion ?? currentGlobalContext.objectRegion ?? currentGlobalContext.userRegion ?? 'MX');
  const locale = currentGlobalContext.locale ?? profile.defaultLocale ?? 'es-MX';
  const currency = currentGlobalContext.currency ?? profile.currency ?? 'MXN';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v / 100);
}
function formatText(v){return String(v)}
function updateProgress(m){
 if(m?.progress!=null)progressBar.style.width=`${Math.max(3,Math.min(96,Math.round(m.progress*100)))}%`;
 const stage=String(m?.status??'').toLowerCase(); if(!stage)return;
 if(/runtime|engine.*load|loading/.test(stage))status.textContent='首次准备本地文字引擎…';
 else if(/worker.*init|initializ/.test(stage))status.textContent='正在启动文字识别…';
 else if(/recogniz|ocr.*pass|reading/.test(stage))status.textContent='正在读取文字…';
 else if(/fallback|timeout|degrad/.test(stage))status.textContent='文字识别较慢，正在安全切换…';
 else if(/preprocess|prepare|decode/.test(stage))status.textContent='正在优化图片…';
 else if(/triage|classif|detect/.test(stage))status.textContent='正在判断图片内容…';
 else if(/complete|done|finish/.test(stage))status.textContent='文字读取完成，正在整理…';
 else status.textContent='正在处理图片…';
}
function resetResult(){pendingExecution=null;pendingVoiceFeedback=null;currentUniversalExplanation=null;if(universalAnswer){universalAnswer.innerHTML='';universalAnswer.hidden=true}fields.innerHTML='';rawText.textContent='';notice.hidden=true;teacher.hidden=true;routeBadge.textContent='';conversation.hidden=true;conversation.innerHTML='';lastAnswer='';currentVisionAttachment=null;speak.hidden=true;session=createConversationSession()}
function showNotice(text){notice.hidden=false;notice.textContent=text}
function humanizeError(e) {
  const code = e?.code || e?.name || '';
  if (code === 'PERCEPTION_ABORTED' || code === 'IMAGE_DECODE_ABORTED') return '操作已取消。';
  if (code === 'OCR_ENGINE_UNAVAILABLE' || code === 'PADDLE_OCR_UNAVAILABLE') return '文字识别引擎暂时不可用，请检查网络或重试。';
  return '处理失败，请重试或换一张图片。';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

async function renderModelManager(){
  if(!modelList)return;
  const cards=[];
  for(const item of modelManager.list()){
    const x=await modelManager.status(item.id);
    const stateLabel={
      ready:'已准备 · 离线可用',
      downloading:'正在下载',
      retrying:'正在重试',
      failed:'准备失败',
      not_installed:'未安装',
    }[x.state]??x.state;
    const pct=x.progress?.total&&x.progress.total>0?Math.min(100,Math.round((x.progress.loaded||0)/x.progress.total*100)):0;
    const size=formatBytes(item.estimatedDownloadBytes);
    cards.push(`<article class="model-card" data-model-id="${escapeHtml(item.id)}">
      <div class="model-card-head"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p></div><span class="model-state ${x.offlineReady?'model-ready':''}">${escapeHtml(stateLabel)}</span></div>
      <div class="model-meta"><span>版本 ${escapeHtml(x.version)}</span><span>预计下载 ${escapeHtml(size)}</span><span>${x.offlineReady?'已缓存验证':'不会自动下载'}</span></div>
      ${(x.state==='downloading'||x.state==='retrying')?`<div class="model-progress"><span style="width:${pct}%"></span></div>`:''}
      ${x.state==='failed'?`<div class="model-error">${escapeHtml(humanizeModelError(x.progress?.errorCode))}</div>`:''}
      <div class="model-warning">用于普通照片中的常见物体/场景理解。OCR、语音、条码无需安装它。</div>
      <div class="model-card-actions">
        ${x.offlineReady?`<button class="remove" data-model-action="remove" data-model-id="${escapeHtml(item.id)}">删除模型</button>`:`<button class="install" data-model-action="install" data-model-id="${escapeHtml(item.id)}" ${x.state==='downloading'||x.state==='retrying'?'disabled':''}>${x.state==='failed'?'重试准备':'准备视觉模型'}</button>`}
      </div>
    </article>`);
  }
  modelList.innerHTML=cards.join('');
  const est=await modelManager.deliveryManager.estimateStorage().catch(()=>({usage:null,quota:null}));
  modelStorage.textContent=`${formatDeviceProfile(currentDeviceProfile)} · ${formatStorageEstimate(est)}`;
  modelList.querySelectorAll('[data-model-action]').forEach(btn=>btn.addEventListener('click',()=>handleModelAction(btn.dataset.modelAction,btn.dataset.modelId)));
}
async function handleModelAction(action,id){
  if(action==='install'){
    const item=modelManager.get(id);if(!item)return;
    const ok=confirm(`这个视觉 Student 预计需要下载约 ${formatBytes(item.estimatedDownloadBytes)}。下载完成后可离线复用。现在准备吗？`);
    if(!ok)return;
    try{
      await modelManager.install(id,{maxBytes:Math.max(item.estimatedDownloadBytes*1.25,64*1024*1024)});
      showNotice('视觉模型已经准备好，之后普通图片可以优先本地识别。');
    }catch(error){
      showNotice(humanizeModelError(error?.code??error?.message));
    }
  }
  if(action==='remove'){
    const ok=confirm('删除本地视觉模型？OCR、语音、条码不会受到影响。');
    if(!ok)return;
    await modelManager.remove(id);showNotice('视觉模型已删除；需要时可以重新准备。');
  }
  await renderModelManager();
}
function updateModelDownloadNotice(e){
  if(e?.type==='model_file_progress'&&e.total){
    const pct=Math.min(100,Math.round(e.loaded/e.total*100));
    showNotice(`正在准备视觉模型：${pct}%`);
  }
}
function humanizeModelError(code){
  const s=String(code||'');
  if(/MODEL_STORAGE_BUDGET_EXCEEDED/.test(s))return '设备可用存储预算不足，没有继续下载。';
  if(/MODEL_NOT_AVAILABLE_OFFLINE/.test(s))return '当前离线，而且本地模型还没有准备完整。';
  if(/MODEL_INTEGRITY_MISMATCH/.test(s))return '模型完整性校验失败，错误文件已经丢弃，请重新准备。';
  if(/MODEL_HTTP_|fetch|network/i.test(s))return '模型下载失败。OCR、语音等功能仍可继续使用，联网后可重试。';
  return '视觉模型这次没有准备成功，其他功能不会受影响，可以稍后重试。';
}
function formatBytes(n){
  n=Number(n);if(!Number.isFinite(n)||n<=0)return '未知';
  if(n>=1024*1024)return `${(n/1024/1024).toFixed(n>=100*1024*1024?0:1)} MB`;
  if(n>=1024)return `${(n/1024).toFixed(1)} KB`;
  return `${n} B`;
}

function formatDeviceProfile(p){
  const tier={low_power:'轻量设备',balanced:'均衡设备',performance:'高性能设备'}[p?.tier]??'未知设备';
  const bits=[tier];
  if(p?.cores)bits.push(`${p.cores} 核`);
  if(p?.memoryGb)bits.push(`约 ${p.memoryGb} GB 内存`);
  if(p?.webgpu)bits.push('WebGPU');
  if(p?.tier==='low_power')bits.push('重型视觉模型将自动降级');
  return bits.join(' · ');
}

function formatStorageEstimate(x){
  const usage=Number(x?.usage),quota=Number(x?.quota);
  if(Number.isFinite(usage)&&Number.isFinite(quota)&&quota>0)return `浏览器存储：已用 ${formatBytes(usage)} / 可用额度 ${formatBytes(quota)}`;
  if(Number.isFinite(usage))return `模型缓存占用：${formatBytes(usage)}`;
  return '浏览器未提供可靠的存储空间估算。';
}

function safeTaskStateStore(){try{return new LocalStorageTaskStateStore()}catch{return null}}
async function restorePendingTaskNotice(){
 if(!taskStateStore)return;
 try{
  const items=await taskStateStore.list();if(!items.length)return;
  const latest=items.sort((a,b)=>String(b.value?.checkpointedAt??'').localeCompare(String(a.value?.checkpointedAt??'')))[0];
  pendingExecution=await loadExecution(taskStateStore,latest.key,{providers:teacherProviders,searchProvider,consent:false,privacyPolicy:{allowImages:false,allowRawText:false},audit:auditLog});
  if(!pendingExecution)return;
  currentPackage=pendingExecution.context.taskPackage;currentObservation=pendingExecution.context.observation;session=createConversationSession({turns:pendingExecution.context.conversation??[]});
  if(pendingExecution.context.verifiedEntity)setVerifiedEntity(session,pendingExecution.context.verifiedEntity);
  teacher.hidden=false;teacher.textContent='继续任务';routeBadge.textContent='可继续';routeBadge.dataset.route='teacher';
  const needsImage=Boolean(currentPackage?.recovery?.mediaOmitted&&currentPackage?.task?.imageRequired);
  showNotice(needsImage?'发现上次未完成的任务。为保护隐私，图片没有永久保存；重新选择原图后可以从断点继续。':'发现上次未完成的任务，可以从断点继续，不必从头处理。');renderConversation();
 }catch(error){console.warn('Task recovery unavailable',error)}
}

function safeAuditLog(){try{return new DurableAuditLog({store:new LocalStorageAuditEventStore()})}catch{return new DurableAuditLog({store:new MemoryAuditEventStore()})}}

function detectUserEnvironment(){
 const locale=navigator.language??null;
 let timezone=null;try{timezone=Intl.DateTimeFormat().resolvedOptions().timeZone??null}catch{}
 return {locale,timezone,region:locale?.split('-')?.[1]??null};
}

import {createStudentObservation} from '../../core/observation/student-observation.js';
import {preprocessImageCandidates} from '../../features/capture/image-preprocessor.js';
import {TesseractOcrEngine} from './tesseract-ocr.js';
import {OcrEngineRegistry} from '../../core/ocr/ocr-engine-registry.js';
import {runOcrEnsemble} from '../../core/ocr/ocr-ensemble.js';
import {OcrEnginePerformanceStore,LocalStorageOcrEnginePerformanceStore} from '../../core/ocr/ocr-engine-performance.js';
import {routeOcrEngines} from '../../core/ocr/ocr-adaptive-router.js';
import {understandProblem} from '../../core/resolution/problem-understanding.js';
import {planResolution} from '../../core/resolution/resolution-router.js';
import {buildVisualAnalysisPlan} from '../../core/vision/visual-analysis-plan.js';
import {strongestVisualIdentityEvidence} from '../../core/vision/visual-evidence-ladder.js';
import {createDefaultVisualProviders} from './vision/default-visual-providers.js';
import {executeVisualCapabilities} from '../../core/vision/providers/visual-provider-executor.js';
import {VisualProviderPerformanceStore} from '../../core/vision/providers/visual-provider-performance.js';
import {detectDeviceProfile} from '../../core/device/device-profile.js';
import {VisualBenchmarkStore,deviceBenchmarkKey} from '../../core/vision/benchmark/visual-benchmark-store.js';
import {tuneVisualPolicy} from '../../core/vision/benchmark/visual-autotuner.js';
import {runPerceptionFastTriage} from '../../core/perception/perception-fast-triage.js';
import {detectRuntimeScenarios} from '../../core/perception/scenario-evidence-policy.js';
import {createPerceptionBudget} from '../../core/perception/perception-budget.js';
import {createRuntimeLatencyBudget,shouldRunHeavyLocalStage,evaluateRuntimeLatency} from '../../core/performance/runtime-latency-budget.js';
import {planOcrFailureRecovery} from '../../core/ocr/ocr-failure-recovery.js';
import {createCriticalPathTrace,analyzeCriticalPath} from '../../core/performance/critical-path-trace.js';

const defaultPerformanceStore=(()=>{
  try{return globalThis.localStorage?new LocalStorageOcrEnginePerformanceStore():new OcrEnginePerformanceStore()}
  catch{return new OcrEnginePerformanceStore()}
})();
const defaultVisualPerformanceStore=new VisualProviderPerformanceStore();
const defaultVisualBenchmarkStore=new VisualBenchmarkStore();

export async function observeImage(file,{ocrEngine=null,ocrEngines=null,onProgress,onFirstUseful=null,preparedSource=null,onPreparedSourceConsumed=null,performanceStore=defaultPerformanceStore,deviceProfile=detectDeviceProfile(),deviceClass=deviceProfile.tier,visualProviders=null,visualPerformanceStore=defaultVisualPerformanceStore,visualBenchmarkStore=defaultVisualBenchmarkStore,visualDeviceBudget=null,userQuestion='',ocrLanguage='auto',runtimeEvidence=null,scenarioEvidence=null,scenarioEvidenceBuilder=null,outcomeValidation=null,outcomeValidationBuilder=null,outcomeStore=null,ocrRecoveryAttempts=0,userCanRecapture=true,criticalPathTrace=null,signal=null}={}){
  throwIfAborted(signal);
  const perceptionStarted=Date.now();
  const trace=criticalPathTrace??createCriticalPathTrace();
  trace.start('fast_triage');
  let triage;
  triage=await runPerceptionFastTriage(file,{userQuestion,preparedSource});
  trace.end('fast_triage',{route:triage?.primaryRoute??null});trace.mark('first_useful');
  const firstUsefulElapsedMs=Date.now()-perceptionStarted;
  onFirstUseful?.({triage,elapsedMs:firstUsefulElapsedMs,phase:'fast_triage'});
  throwIfAborted(signal);
  const runtimeScenarios=detectRuntimeScenarios({modality:'vision',triage,userQuestion});
  if(scenarioEvidenceBuilder)scenarioEvidence=scenarioEvidenceBuilder(runtimeScenarios);
  if(outcomeValidationBuilder)outcomeValidation=outcomeValidationBuilder(runtimeScenarios);
  const perceptionBudget=createPerceptionBudget(deviceProfile,triage);
  const runtimeBudget=createRuntimeLatencyBudget(deviceProfile);
  const firstUsefulAt=Date.now();
  onProgress?.({status:triage.primaryRoute==='document'?'正在读取图片文字…':'正在理解图片…',perceptionEvent:{type:'fast_triage_completed',triage}});

  // Universal images must not pay the full receipt/OCR tax by default.
  // OCR remains a specialist branch and is run only when triage sees text/document evidence.
  let preprocessing={quality:null,candidates:[]},ensemble=null,ocr=null,normalization={normalizedText:'',changed:false,confidence:0,transformations:[]},receipt=emptyReceipt(),ocrRecovery=null;
  let preprocessed={operations:{},width:null,height:null,candidatePlans:[]};
  let routing={strategy:'deferred',difficulty:{level:'unknown'},budget:{maxEngines:0,maxPassesPerEngine:0,maxTotalRecognitions:0},ranking:[]};

  const ocrIsPrimary=triage.ocrMode==='primary';
  if(triage.needsOcr&&ocrIsPrimary){
    trace.start('ocr_preprocess',{candidates:perceptionBudget.ocrCandidates});
    const ocrMaxDimension=deviceClass==='low_power'?1400:deviceClass==='performance'?1900:1650;
    throwIfAborted(signal);
    preprocessing=await preprocessImageCandidates(file,{maxDimension:ocrMaxDimension,maxCandidates:perceptionBudget.ocrCandidates,preparedSource,signal,decodeTimeoutMs:Math.min(3500,Math.max(500,perceptionBudget.totalLocalMs-(Date.now()-perceptionStarted))),totalBudgetMs:Math.max(250,perceptionBudget.totalLocalMs-(Date.now()-perceptionStarted))});
    trace.end('ocr_preprocess',{actualCandidates:preprocessing.candidates.length,sourceReuse:preprocessing.sourceReuse});
    const registry=new OcrEngineRegistry(ocrEngines??[ocrEngine??new TesseractOcrEngine()]);
    const capable=registry.select({language:ocrLanguage,requiredCapabilities:['text']});
    routing=routeOcrEngines({engines:capable,quality:preprocessing.quality,performanceStore,deviceClass});
    // Perception budget is allowed to tighten OCR's own adaptive budget.
    routing={...routing,budget:{
      ...routing.budget,
      maxEngines:Math.min(routing.budget.maxEngines,perceptionBudget.ocrEngines),
      maxTotalRecognitions:Math.min(routing.budget.maxTotalRecognitions,Math.max(1,perceptionBudget.ocrCandidates*perceptionBudget.ocrEngines)),
    }};
    trace.start('ocr_ensemble',{engines:routing.budget.maxEngines});
    try{ensemble=await runOcrEnsemble({
      candidates:preprocessing.candidates,engines:routing.engines,language:ocrLanguage,onProgress,
      maxEngines:routing.budget.maxEngines,maxPassesPerEngine:routing.budget.maxPassesPerEngine,
      maxTotalRecognitions:routing.budget.maxTotalRecognitions,earlyStopScore:routing.budget.earlyStopScore,performanceStore,
      // OCR is part of the user-visible local critical path. A vendor adapter's
      // own generous timeout must never override the device-level perception budget.
      totalBudgetMs:Math.max(500,perceptionBudget.totalLocalMs-(Date.now()-perceptionStarted)),
      perRecognitionTimeoutMs:deviceClass==='low_power'?1800:deviceClass==='performance'?3200:2400,
      signal,
    });}catch(error){for(const candidate of preprocessing.candidates)candidate.release?.();throw error}
    trace.end('ocr_ensemble',{recognitions:ensemble.totalRecognitions??0,engine:ensemble.selectedEngineId??null});
    for(const [stage,durationMs] of Object.entries(ensemble.stageTimings??{}))trace.record?.(`ocr_${stage}`,durationMs,{engine:ensemble.selectedEngineId??null,nested:true});
    ({ocr,normalization,receipt}=ensemble.selected);
    ocrRecovery=planOcrFailureRecovery({quality:preprocessing.quality,ensemble,receipt,deviceClass,attempts:ocrRecoveryAttempts,userCanRecapture});
    preprocessed=preprocessing.candidates.find(x=>x.planId===ensemble.selectedPlanId)??preprocessing.candidates[0];
    // OCR is finished; release candidate canvases before visual reasoning to
    // keep mobile peak memory bounded. Metadata on preprocessed remains valid.
    for(const candidate of preprocessing.candidates)candidate.release?.();
  }

  onPreparedSourceConsumed?.();

  if(triage.needsOcr&&!ocrIsPrimary){
    // Text inside a natural image is supporting evidence. Do not block the
    // universal-vision fast path with full preprocessing + OCR ensemble.
    // The Brain can request a text-focused crop/OCR pass later when that text
    // is decisive for the user's question.
  }

  const required=[receipt?.total,receipt?.date];
  const localResolutionPossible=triage.primaryRoute==='document'&&required.every(f=>f?.value!=null&&f.confidence>=0.85);
  const baseObservation=createStudentObservation({
    modality:'image',
    detectedType:triage.primaryRoute==='document'?(receipt?.receiptType?.type??'document_candidate'):'unknown',
    extractedText:normalization.normalizedText,
    observations:[
      {kind:'file_metadata',name:file.name,size:file.size,type:file.type},
      triage,
      {kind:'perception_budget',...perceptionBudget,runtime:runtimeBudget},
      {kind:'image_source_reuse',sharedDecode:Boolean(preparedSource),policy:preparedSource?'SHARED_DECODE_FOR_TRIAGE_AND_ATTACHMENT':'INDEPENDENT_DECODE'},
      ...(ocrIsPrimary?[
        {kind:'image_preprocessing',...preprocessed.operations,width:preprocessed.width,height:preprocessed.height,quality:preprocessing.quality,candidatePlans:preprocessed.candidatePlans,selectedByOcr:ensemble?.selectedPlanId??null},
        {kind:'ocr_routing',strategy:routing.strategy,difficulty:routing.difficulty,deviceClass,budget:routing.budget,ranking:routing.ranking},
        {kind:'ocr_ensemble',selectedEngineId:ensemble?.selectedEngineId??null,selectedEngineVersion:ensemble?.selectedEngineVersion??null,selectedPlanId:ensemble?.selectedPlanId??null,totalRecognitions:ensemble?.totalRecognitions??0,engines:ensemble?.engines??[],performance:performanceStore.snapshot()},
        {kind:'ocr_recovery',...ocrRecovery},
        {kind:'ocr',engineId:ocr?.engineId??null,confidence:ocr?.confidence??0,rawText:ocr?.text??'',blocks:ocr?.blocks??[],capabilities:ocr?.capabilities??{}},
        {kind:'ocr_normalization',changed:normalization.changed,confidence:normalization.confidence,transformations:normalization.transformations,normalizedText:normalization.normalizedText},
        {kind:'receipt_fields',receipt},
        {kind:'specialized_document',documentType:receipt?.specialized?.documentType??receipt?.receiptType?.type??'unknown',routed:Boolean(receipt?.specialized?.routed),parserId:receipt?.specialized?.parserId??null,fields:receipt?.specialized?.fields??{},checks:receipt?.specialized?.checks??[]},
        {kind:'structured_facts',documentType:receipt?.facts?.documentType??null,summary:receipt?.facts?.summary??{},facts:receipt?.facts?.facts??[],policy:receipt?.facts?.policy??{}},
      ]:[]),
    ],
    confidence:{identity:0,fact:ocrIsPrimary?fieldAverage(receipt):0,evidence:triage.confidence,recommendation:0,action:localResolutionPossible?.9:.3,overall:Math.max(.25,triage.confidence*.55)},
    limitations:[],
    localResolutionPossible,
    localResolutionReason:localResolutionPossible?'Document has reliable key fields':'Universal perception continues through visual capabilities',
  });
  const providers=visualProviders??createDefaultVisualProviders({enableGeneralVision:false});
  baseObservation.observations.push({kind:'perception_timing',phase:'fast_path',elapsedMs:Date.now()-perceptionStarted,targetMs:perceptionBudget.firstUsefulMs});
  const benchmarkKey=deviceBenchmarkKey(deviceProfile);
  const benchmarks=visualBenchmarkStore.list({deviceKey:benchmarkKey});
  const autotunePolicy=tuneVisualPolicy({profile:deviceProfile,benchmarks,providers});
  baseObservation.observations.push({kind:'device_profile',...deviceProfile,benchmarkKey});
  baseObservation.observations.push({kind:'visual_autotune_policy',...autotunePolicy});
  let visualPlan=buildVisualAnalysisPlan({observation:baseObservation,userQuestion,availableCapabilities:[]});
  const requested=visualPlan.providerExecution?.requiredCapabilities??[];
  if(requested.length&&providers.length){
    const elapsedMs=Date.now()-perceptionStarted;
    const heavyGate=shouldRunHeavyLocalStage({elapsedMs,budget:runtimeBudget,deviceProfile,estimatedMs:autotunePolicy.timeoutMs});
    if(!heavyGate.allowed){
      baseObservation.observations.push({kind:'visual_provider_execution',status:'deferred',reason:heavyGate.reason,elapsedMs,policy:'FAST_PATH_FIRST'});
      baseObservation.limitations.push({code:'HEAVY_LOCAL_VISION_DEFERRED',reason:heavyGate.reason});
      onProgress?.({status:'本地快速识别已完成；复杂视觉分析已按设备速度预算暂缓。',perceptionEvent:{type:'heavy_local_deferred',reason:heavyGate.reason}});
    }else{
    const budget=visualDeviceBudget??{maxMemoryMb:autotunePolicy.memoryBudgetMb};
    trace.start('visual_capabilities',{requested:[...requested]});
    const execution=await executeVisualCapabilities({
      image:file,capabilities:requested,providers,deviceClass,deviceBudget:budget,
      performanceStore:visualPerformanceStore,
      benchmarkStore:visualBenchmarkStore,deviceBenchmarkKey:benchmarkKey,autotunePolicy,runtimeEvidence,scenarioEvidence,outcomeValidation,outcomeStore,outcomeContext:{deviceKey:benchmarkKey,scenarios:runtimeScenarios},
      onEvent:e=>onProgress?.({status:e.type==='provider_started'?'正在理解图片…':e.type==='visual_budget_exhausted'?'本地视觉时间预算已用完，正在整理已有结果…':undefined,visualEvent:e}),
      timeoutMs:autotunePolicy.timeoutMs,
      // Loading and inference share one user-visible budget. Multiple visual
      // capabilities/providers must not multiply timeout windows serially.
      loadTimeoutMs:Math.min(8000,Math.max(1000,runtimeBudget.totalLocalMs)),
      totalBudgetMs:Math.max(500,perceptionBudget.totalLocalMs-(Date.now()-perceptionStarted)),
    });
    trace.end('visual_capabilities',{resultCount:execution.results?.length??0});
    baseObservation.observations.push({kind:'visual_provider_execution',...execution,deviceClass,deviceBudget:budget});
    const seen=new Set();
    for(const r of execution.results){
      if(r.status!=='ok'||!r.output)continue;
      const key=`${r.providerId}|${r.output.kind??'vision'}`;
      if(seen.has(key))continue;seen.add(key);
      baseObservation.observations.push(r.output);
    }
    visualPlan=buildVisualAnalysisPlan({observation:baseObservation,userQuestion,availableCapabilities:[]});
    }
  }
  const identityReality=strongestVisualIdentityEvidence(baseObservation);
  baseObservation.observations.push({
    kind:'visual_capability_reality',
    objectIdentityResolved:visualPlan.route?.localCapabilities?.includes('object_identity')??false,
    identityEvidenceLevel:identityReality.level,
    identityConfidence:identityReality.confidence,
    specificIdentityResolved:identityReality.rank>=4&&identityReality.confidence>=.7,
    unresolved:[...(visualPlan.route?.missingCapabilities??[])],
    policy:'CONFIDENCE_DOES_NOT_INCREASE_SEMANTIC_SPECIFICITY',
  });
  trace.mark('local_perception_complete');
  const criticalPathSnapshot=trace.snapshot();
  baseObservation.observations.push(criticalPathSnapshot);
  baseObservation.observations.push(analyzeCriticalPath(criticalPathSnapshot));
  baseObservation.observations.push({kind:'runtime_latency',...evaluateRuntimeLatency({startedAt:perceptionStarted,firstUsefulAt,completedAt:Date.now(),budget:runtimeBudget})});
  baseObservation.observations.push({kind:'visual_capability_plan',...visualPlan});
  promoteGeneralVisionIdentity(baseObservation);
  const problem=understandProblem(baseObservation,{});
  const resolution=planResolution({observation:baseObservation,problem,context:{visualPlan}});
  baseObservation.observations.push({kind:'problem_understanding',...problem});
  baseObservation.observations.push({kind:'resolution_plan',...resolution});
  baseObservation.problem=problem;
  baseObservation.resolution=resolution;
  return baseObservation;
}

function fieldAverage(r){const arr=[r.merchant,r.date,r.subtotal,r.tax,r.total].filter(x=>x?.value!=null);return arr.length?arr.reduce((s,x)=>s+(x.confidence||0),0)/arr.length:0;}


function promoteGeneralVisionIdentity(observation){
  const general=(observation.observations??[]).filter(x=>x.kind==='general_vision');
  const candidates=general.flatMap(g=>(g.identity??[]).map(x=>({...x,providerId:g.providerId})))
    .filter(x=>x.label&&Number(x.confidence??0)>0).sort((a,b)=>Number(b.confidence??0)-Number(a.confidence??0));
  if(candidates.length){
    observation.observations.push({kind:'visual_identity',candidates:candidates.slice(0,12),top:candidates[0]});
    if((observation.detectedType==='unknown'||observation.detectedType==='receipt_candidate')&&Number(candidates[0].confidence)>=.7){
      observation.detectedType='object';
    }
    observation.confidence.identity=Math.max(Number(observation.confidence.identity??0),Number(candidates[0].confidence??0));
    observation.confidence.overall=Math.max(Number(observation.confidence.overall??0),Math.min(.9,Number(candidates[0].confidence??0)));
  }
}

function emptyReceipt(){
  const field=()=>({value:null,confidence:0});
  return {receiptType:{type:'unknown'},merchant:field(),date:field(),subtotal:field(),tax:field(),total:field(),specialized:null,facts:null};
}

function throwIfAborted(signal){if(signal?.aborted){const e=new Error('PERCEPTION_ABORTED');e.code='PERCEPTION_ABORTED';throw e}}

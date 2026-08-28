import {observeImage} from '../../../../providers/local/local-student.js';
import {PilotLabController} from '../../../../core/perception/lab/pilot-lab-controller.js';
import {WORLD_VISION_CATEGORIES,VOICE_CATEGORIES} from '../../../../core/perception/lab/world-benchmark-blueprint.js';
import {BenchmarkAssetVault,isVaultRef} from '../../../../core/perception/lab/benchmark-asset-vault.js';
import {runEngineCompetition} from '../../../../core/perception/lab/benchmark-competition.js';
import {scoreVisionBenchmarkCase} from '../../../../core/perception/lab/vision-benchmark-scorer.js';
import {scoreVoiceBenchmarkCase} from '../../../../core/perception/lab/voice-benchmark-scorer.js';
import {deviceKeyFor} from '../../../../core/perception/perception-engine-selector.js';
import {getExperimentalEngineSpec,createExperimentalEngine,canOfferExperimentalEngine} from '../../../../core/perception/lab/experimental-engine-catalog.js';
import {wrapExperimentalVisionEngine} from '../../../../core/perception/lab/experimental-benchmark-engine.js';
import {getExperimentalVoiceEngineSpec,createExperimentalVoiceEngine,canOfferExperimentalVoiceEngine} from '../../../../core/perception/lab/experimental-voice-engine-catalog.js';
import {runMultimodalCorpus} from '../../../../core/perception/lab/multimodal-case-runner.js';
import {runVoiceLeague,buildVoiceLeagueMatrix,recommendVoiceEngineForCohort} from '../../../../core/perception/lab/voice-league.js';

const $=s=>document.querySelector(s);

export function setupPilotLabRuntime({storage=null,labResults,currentDeviceProfile,voiceRegistry,ocrEngines,buildApprovedVisualProviders,formatBytes,escapeHtml}={}){
 const pilotLab=new PilotLabController({storage});
 const benchmarkAssets=new BenchmarkAssetVault();
const pilotLabButton=$('#pilotLabButton'),pilotLabPanel=$('#pilotLabPanel'),pilotLabClose=$('#pilotLabClose'),pilotLabStats=$('#pilotLabStats'),pilotModality=$('#pilotModality'),pilotCategory=$('#pilotCategory'),pilotAssetFile=$('#pilotAssetFile'),pilotAssetName=$('#pilotAssetName'),pilotSpeechText=$('#pilotSpeechText'),pilotExpected=$('#pilotExpected'),pilotLanguage=$('#pilotLanguage'),pilotAdd=$('#pilotAdd'),pilotLabMessage=$('#pilotLabMessage'),pilotCaseList=$('#pilotCaseList'),pilotExport=$('#pilotExport'),pilotImport=$('#pilotImport'),pilotRunVision=$('#pilotRunVision'),pilotRunVoice=$('#pilotRunVoice'),pilotRunProgress=$('#pilotRunProgress'),pilotBenchmarkResults=$('#pilotBenchmarkResults'),pilotRunMultimodal=$('#pilotRunMultimodal'),pilotSmolVlm=$('#pilotSmolVlm'),pilotWhisperTiny=$('#pilotWhisperTiny'),pilotMoonshine=$('#pilotMoonshine'),pilotSherpa=$('#pilotSherpa');
let pendingPilotAsset=null;
const smolVlmSpec=getExperimentalEngineSpec('smolvlm-256m');
const smolVlmOffer=canOfferExperimentalEngine(smolVlmSpec,currentDeviceProfile);
if(pilotSmolVlm&&!smolVlmOffer.allowed){pilotSmolVlm.disabled=true;pilotSmolVlm.title='当前设备档位不建议加载此实验 VLM。'}
const whisperTinySpec=getExperimentalVoiceEngineSpec('whisper-tiny-multilingual');
const whisperTinyOffer=canOfferExperimentalVoiceEngine(whisperTinySpec,currentDeviceProfile);
if(pilotWhisperTiny&&!whisperTinyOffer.allowed){pilotWhisperTiny.disabled=true;pilotWhisperTiny.title='当前设备档位不建议加载此实验 ASR。'}
const moonshineSpec=getExperimentalVoiceEngineSpec('moonshine-base-en');
const moonshineOffer=canOfferExperimentalVoiceEngine(moonshineSpec,currentDeviceProfile);
if(pilotMoonshine&&!moonshineOffer.allowed){pilotMoonshine.disabled=true;pilotMoonshine.title='当前设备档位不建议加载此实验 ASR。'}
const sherpaSpec=getExperimentalVoiceEngineSpec('sherpa-zh-en-wasm');
const sherpaOffer=canOfferExperimentalVoiceEngine(sherpaSpec,currentDeviceProfile);
const sherpaRuntimeLoader=globalThis.__SEEMIND_SHERPA_WASM_LOADER__??null;
if(pilotSherpa){
 pilotSherpa.disabled=!sherpaOffer.allowed||typeof sherpaRuntimeLoader!=='function';
 pilotSherpa.title=typeof sherpaRuntimeLoader==='function'?'':'Sherpa WASM runtime 尚未安装；不会伪造可用状态。';
}

pilotLabClose?.addEventListener('click',()=>{pilotLabPanel.hidden=true});
pilotModality?.addEventListener('change',()=>{renderPilotCategories();pendingPilotAsset=null;if(pilotAssetFile)pilotAssetFile.value='';if(pilotAssetName)pilotAssetName.textContent='尚未选择素材';});
pilotAssetFile?.addEventListener('change',async()=>{
 const f=pilotAssetFile.files?.[0];if(!f){pendingPilotAsset=null;return}
 try{
  pendingPilotAsset=await benchmarkAssets.put(f,{kind:pilotModality.value,meta:{language:pilotLanguage.value||'auto'}});
  pilotAssetName.textContent=`${pendingPilotAsset.name} · ${formatBytes(pendingPilotAsset.size)}`;
  pilotLabMessage.textContent='真实素材已经保存到本机 Benchmark Asset Vault。';
 }catch(e){pendingPilotAsset=null;pilotAssetName.textContent='素材保存失败';pilotLabMessage.textContent=`无法保存素材：${e.message}`}
});
pilotAdd?.addEventListener('click',()=>{
 try{
  const modality=pilotModality.value,assetRef=pendingPilotAsset?.assetRef??'',language=pilotLanguage.value.trim()||'auto',expectedText=pilotExpected.value.trim();
  if(modality==='vision')pilotLab.addCase({modality,assetRef,category:pilotCategory.value,expectedLabels:expectedText.split(',').map(x=>x.trim()).filter(Boolean),language});
  else if(modality==='voice')pilotLab.addCase({modality,assetRef,category:pilotCategory.value,expectedText,language});
  else{
   const [target,intent='explain',reference='',stateOrProblem='']=expectedText.split('|').map(x=>x.trim());
   pilotLab.addCase({modality,assetRef,language,expected:{target,intent,reference,stateOrProblem}});
  }
  pilotLab.save();pendingPilotAsset=null;if(pilotAssetFile)pilotAssetFile.value='';if(pilotAssetName)pilotAssetName.textContent='尚未选择素材';pilotExpected.value='';if(pilotSpeechText)pilotSpeechText.value='';pilotLabMessage.textContent='已加入。请确认 Ground Truth 是人工核对后的真实答案。';renderPilotLab();
 }catch(e){pilotLabMessage.textContent=`无法加入：${e.message}`}
});
pilotCaseList?.addEventListener('click',async e=>{const id=e.target?.dataset?.remove;if(id){const c=pilotLab.getCase(id);pilotLab.remove(id);if(c?.assetRef&&isVaultRef(c.assetRef))await benchmarkAssets.remove(c.assetRef).catch(()=>{});renderPilotLab()}});
pilotExport?.addEventListener('click',()=>{
 const blob=new Blob([pilotLab.exportJson()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='seemind-pilot-corpus.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
});
pilotImport?.addEventListener('change',async()=>{const f=pilotImport.files?.[0];if(!f)return;try{pilotLab.importJson(await f.text());pilotLabMessage.textContent='测试集已导入。';renderPilotLab()}catch(e){pilotLabMessage.textContent=`导入失败：${e.message}`}finally{pilotImport.value=''}});
pilotRunVision?.addEventListener('click',()=>runPilotVisionBenchmark());
pilotRunVoice?.addEventListener('click',()=>runPilotVoiceBenchmark());
pilotRunMultimodal?.addEventListener('click',()=>runPilotMultimodalBenchmark());
pilotWhisperTiny?.addEventListener('change',()=>renderPilotLab());
pilotMoonshine?.addEventListener('change',()=>renderPilotLab());
pilotSherpa?.addEventListener('change',()=>renderPilotLab());

renderPilotCategories();

function renderPilotCategories(){
 if(!pilotCategory||!pilotModality)return;
 const m=pilotModality.value;
 const cats=m==='vision'?WORLD_VISION_CATEGORIES:m==='voice'?VOICE_CATEGORIES:[{id:'visual_reference'}];
 pilotCategory.innerHTML=cats.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.id)}</option>`).join('');
 pilotExpected.placeholder=m==='vision'?'正确标签，多个用逗号分隔':m==='voice'?'人工确认的完整转写': '目标|意图|指代|状态，例如 红灯|explain|右边这个|闪烁';
 if(pilotSpeechText){pilotSpeechText.style.display=m==='multimodal'?'':'none';}
 if(pilotAssetFile)pilotAssetFile.accept=m==='vision'?'image/*':m==='voice'?'audio/*':'image/*,audio/*';
}
function renderPilotLab(){
 const d=pilotLab.dashboard(),counts=d.status.counts,targets=d.status.targets;
 pilotLabStats.innerHTML=['vision','voice','multimodal'].map(k=>`<div class="lab-stat"><strong>${counts[k]}/${targets[k]}</strong><span>${k}</span></div>`).join('');
 const messages=[];
 if(d.truth.blocking)messages.push(`${d.truth.blocking} 个案例缺少可用于评分的 Ground Truth`);
 if(d.world&&!d.world.passed)messages.push(`万物视觉覆盖尚未合格${d.world.documentShare>.15?'；文件/票据比例过高':''}`);
 if(d.status.ready&&d.truth.usable)messages.push('Pilot 数量与 Ground Truth 已达到基础要求，可进入真实引擎 Benchmark。');
 pilotLabMessage.textContent=messages.join(' · ')||'先收集真实案例。不要为了凑数量伪造答案。';
 const audioCapable=voiceRegistry.supported().filter(e=>typeof e.transcribeCase==='function'||typeof e.transcribe==='function');
 const experimentalVoiceReady=Boolean((pilotWhisperTiny?.checked&&whisperTinyOffer.allowed)||(pilotMoonshine?.checked&&moonshineOffer.allowed)||(pilotSherpa?.checked&&typeof sherpaRuntimeLoader==='function'));
 if(pilotRunVoice){pilotRunVoice.disabled=!(audioCapable.length||experimentalVoiceReady);pilotRunVoice.title=(audioCapable.length||experimentalVoiceReady)?'':'勾选一个可处理预录音频的实验 ASR 后即可运行。'}
 pilotCaseList.innerHTML=d.cases.slice().reverse().map(c=>`<div class="lab-case"><div><strong>${escapeHtml(c.id)} · ${escapeHtml(c.modality)} · ${escapeHtml(c.category??'')}</strong><small>${escapeHtml(c.assetRef)} · ${escapeHtml(formatExpected(c.expected))}</small></div><button data-remove="${escapeHtml(c.id)}" aria-label="删除">×</button></div>`).join('');
 if(pilotBenchmarkResults&&!pilotBenchmarkResults.innerHTML.trim())renderStoredCompetitionResults();
}

async function runPilotVisionBenchmark(){
 const d=pilotLab.dashboard();
 const cases=d.cases.filter(c=>c.modality==='vision'&&isVaultRef(c.assetRef)&&(c.expected?.labels??[]).length);
 if(!cases.length){pilotRunProgress.textContent='没有可运行的 Vision 案例：请先上传真实图片并填写人工确认标签。';return}
 pilotRunVision.disabled=true;pilotRunProgress.textContent='正在准备可用视觉引擎…';pilotBenchmarkResults.innerHTML='';
 let experimentalAdapter=null;
 try{
  const visualProviders=await buildApprovedVisualProviders();
  const engines=[{
    id:'seemind-current-vision',
    infer:async blob=>observeImage(blob,{ocrEngines,visualProviders,onProgress:null}),
  }];
  for(const provider of visualProviders){
   const caps=(provider.getProfile?.().capabilities??[]).map(x=>x.capability);
   if(!caps.some(x=>x==='object_identity'||x==='scene_context'))continue;
   engines.push({
    id:`visual:${provider.id}`,
    infer:async blob=>provider.analyze(blob,{capabilities:caps.filter(x=>x==='object_identity'||x==='scene_context')}),
   });
  }
  if(pilotSmolVlm?.checked){
   const ok=confirm(`SmolVLM 256M 是实验候选，首次运行可能需要下载约 ${smolVlmSpec.estimatedDownloadMb}MB，并占用约 ${smolVlmSpec.estimatedMemoryMb}MB 运行内存。它只参加本次 Lab，不会自动成为默认引擎。继续吗？`);
   if(!ok)throw Object.assign(new Error('EXPERIMENTAL_ENGINE_NOT_APPROVED'),{code:'EXPERIMENTAL_ENGINE_NOT_APPROVED'});
   experimentalAdapter=createExperimentalEngine('smolvlm-256m');
   engines.push(wrapExperimentalVisionEngine(experimentalAdapter));
  }
  const competition=await runEngineCompetition({
   engines,modality:'vision',cases,deviceProfile:currentDeviceProfile,corpusId:pilotLab.manifest().id,
   resolveAsset:ref=>benchmarkAssets.resolve(ref),scoreCase:scoreVisionBenchmarkCase,baselineEngineId:'seemind-current-vision',
   onProgress:e=>{pilotRunProgress.textContent=`${e.engineId}：${e.completed}/${e.total} · 引擎 ${e.engineIndex}/${e.engineTotal}`},
  });
  saveCompetitionResults(competition);renderCompetition(competition);
  pilotRunProgress.textContent=`Vision Benchmark 完成：${cases.length} 个真实案例，${engines.length} 个当前可用引擎。`;
 }catch(e){pilotRunProgress.textContent=e?.code==='EXPERIMENTAL_ENGINE_NOT_APPROVED'?'已取消实验 VLM，本次没有运行。':`Vision Benchmark 失败：${e.message}`}
 finally{await experimentalAdapter?.dispose?.().catch(()=>{});pilotRunVision.disabled=false}
}
async function runPilotMultimodalBenchmark(){
 const d=pilotLab.dashboard();
 const cases=d.cases.filter(c=>c.modality==='multimodal'&&isVaultRef(c.assetRef)&&String(c.input?.speechText??c.input?.textInput??'').trim());
 if(!cases.length){pilotRunProgress.textContent='没有可运行的多模态案例：需要真实图片 + 用户当时说的话 + Ground Truth。';return}
 pilotRunMultimodal.disabled=true;pilotBenchmarkResults.innerHTML='';
 try{
  const visualProviders=await buildApprovedVisualProviders();
  const result=await runMultimodalCorpus({
   cases,resolveAsset:ref=>benchmarkAssets.resolve(ref),
   observeImage:blob=>observeImage(blob,{ocrEngines,visualProviders,onProgress:null}),
   onProgress:e=>{pilotRunProgress.textContent=`Multimodal：${e.completed}/${e.total}`},
  });
  const a=result.summary;
  pilotBenchmarkResults.innerHTML=`<div class="lab-result-row"><strong>SeeMind Multimodal</strong><span>Grounding ${fmtPct(a.avgGroundingScore)}</span><span>成功 ${fmtPct(a.successRate)}</span><span>p50 ${fmtMs(a.p50LatencyMs)}</span><span>p95 ${fmtMs(a.p95LatencyMs)}</span></div>`+
   result.results.map(x=>`<div class="lab-decision">${escapeHtml(x.caseId)} · ${x.ok?'score '+fmtPct(x.score?.score):'失败 '+escapeHtml(x.error?.code??'UNKNOWN')}</div>`).join('');
  pilotRunProgress.textContent=`Multimodal Benchmark 完成：${cases.length} 个真实图片+语言案例。`;
 }catch(e){pilotRunProgress.textContent=`Multimodal Benchmark 失败：${e.message}`}
 finally{pilotRunMultimodal.disabled=false}
}

async function runPilotVoiceBenchmark(){
 const engines=voiceRegistry.supported().filter(e=>typeof e.transcribeCase==='function'||typeof e.transcribe==='function');
 const experimental=[];
 if(pilotWhisperTiny?.checked){
  const ok=confirm(`Whisper Tiny 多语种是实验 ASR，首次运行预计需要下载约 ${whisperTinySpec.estimatedDownloadMb}MB，并占用约 ${whisperTinySpec.estimatedMemoryMb}MB 运行内存。它只参加 Voice Lab，不会替代实时 WebSpeech。继续吗？`);
  if(!ok){pilotRunProgress.textContent='已取消 Whisper Tiny，本次继续检查其他候选。'}
  else{
   const e=createExperimentalVoiceEngine('whisper-tiny-multilingual');
   if(e.isSupported()){engines.push(e);experimental.push(e)}
   else pilotRunProgress.textContent='当前浏览器缺少 WebAudio/WebAssembly，Whisper Tiny 无法运行。';
  }
 }
 if(pilotMoonshine?.checked){
  const ok=confirm(`Moonshine Base 是英语低延迟实验 ASR，首次运行预计需要下载约 ${moonshineSpec.estimatedDownloadMb}MB，并占用约 ${moonshineSpec.estimatedMemoryMb}MB。它只参加英语 Voice League。继续吗？`);
  if(!ok){pilotRunProgress.textContent='已取消 Moonshine，本次继续使用其他可用候选。'}
  else{
   const e=createExperimentalVoiceEngine('moonshine-base-en');
   if(e.isSupported()){engines.push(e);experimental.push(e)}
   else pilotRunProgress.textContent='当前浏览器缺少 WebAudio/WebAssembly，Moonshine 无法运行。';
  }
 }
 if(pilotSherpa?.checked&&typeof sherpaRuntimeLoader==='function'){
  const ok=confirm('Sherpa-ONNX WASM 是中/英语音实验候选。只有本机已安装兼容 runtime 与模型时才会运行；本版本不会自动下载或猜测模型。继续吗？');
  if(ok){
   const e=createExperimentalVoiceEngine('sherpa-zh-en-wasm',{runtimeLoader:sherpaRuntimeLoader,modelConfig:globalThis.__SEEMIND_SHERPA_MODEL_CONFIG__??{}});
   engines.push(e);experimental.push(e);
  }
 }
 if(!engines.length){pilotRunProgress.textContent='当前没有能够读取预录音频文件的 Voice Engine。';return}
 const d=pilotLab.dashboard();
 const cases=d.cases.filter(c=>c.modality==='voice'&&isVaultRef(c.assetRef)&&String(c.expected?.text??'').trim());
 if(!cases.length){pilotRunProgress.textContent='没有可运行的 Voice 案例：请先上传真实音频并填写人工确认转写。';await Promise.all(experimental.map(e=>e.dispose?.().catch(()=>{})));return}
 pilotRunVoice.disabled=true;pilotBenchmarkResults.innerHTML='';
 try{
  const league=await runVoiceLeague({
   engines,cases,deviceProfile:currentDeviceProfile,corpusId:pilotLab.manifest().id,
   resolveAsset:ref=>benchmarkAssets.resolve(ref),scoreCase:scoreVoiceBenchmarkCase,
   onProgress:e=>{pilotRunProgress.textContent=`${e.language} · ${e.engineId}：${e.completed}/${e.total} · 引擎 ${e.engineIndex}/${e.engineTotal}`},
  });
  renderVoiceLeague(league);
  for(const round of league.rounds){
   if(round.status!=='completed')continue;
   saveCompetitionResults(round.competition);
  }
  const completed=league.rounds.filter(x=>x.status==='completed').length;
  pilotRunProgress.textContent=`Voice League 完成：${cases.length} 个真实音频案例，${completed} 个语言分组。`;
 }catch(e){pilotRunProgress.textContent=`Voice Benchmark 失败：${e.message}`}
 finally{await Promise.all(experimental.map(e=>e.dispose?.().catch(()=>{})));pilotRunVoice.disabled=false;renderPilotLab()}
}
function renderVoiceLeague(league){
 const matrix=buildVoiceLeagueMatrix(league);
 pilotBenchmarkResults.innerHTML=league.rounds.map(round=>{
  if(round.status!=='completed')return `<div class="lab-decision">${escapeHtml(round.language)}：没有可用引擎，已跳过。</div>`;
  const c=round.competition;
  const rows=c.decisions.map(d=>{
   const m=d.metrics,base=d.engineId===c.baselineEngineId;
   const verdict=base?'基线':d.comparison?.verdict==='IMPROVEMENT'?'优于基线':d.comparison?.verdict==='REGRESSION'?'退步':'接近/混合';
   return `<div><div class="lab-result-row"><strong>${escapeHtml(round.language)} · ${escapeHtml(d.engineId)}${base?' · baseline':''}</strong><span>质量 ${fmtPct(m.avgQuality)}</span><span>成功 ${fmtPct(m.successRate)}</span><span>p50 ${fmtMs(m.p50LatencyMs)}</span><span>p95 ${fmtMs(m.p95LatencyMs)}</span></div><div class="lab-decision">${escapeHtml(verdict)} · ${d.promotion?.promoted?'达到 Canary 条件':'继续留在 Lab'}</div></div>`;
  }).join('');
  const recommendation=recommendVoiceEngineForCohort(matrix[round.language]??{});
  const rec=recommendation?`<div class="lab-decision"><strong>${escapeHtml(round.language)} 当前证据领先：</strong> ${escapeHtml(recommendation.engineId)} · 仅作为 Lab 证据，不自动切换生产引擎。</div>`:'';
  return rows+rec;
 }).join('');
}

function saveCompetitionResults(competition){
 const deviceKey=deviceKeyFor(currentDeviceProfile);
 for(const d of competition.decisions)labResults.save({engineId:d.engineId,modality:competition.modality,deviceKey,metrics:d.metrics,promotion:d.promotion,meta:{baselineEngineId:d.baselineEngineId,comparison:d.comparison,corpusId:competition.corpusId,failurePatterns:(competition.failureAnalysis?.patterns??[]).filter(x=>x.engineId===d.engineId)}});
}
function renderCompetition(competition){
 const rows=competition.decisions;
 pilotBenchmarkResults.innerHTML=rows.map(d=>{
  const m=d.metrics,base=d.engineId===competition.baselineEngineId;
  const verdict=base?'基线':d.comparison?.verdict==='IMPROVEMENT'?'优于基线':d.comparison?.verdict==='REGRESSION'?'退步':'接近/混合';
  return `<div><div class="lab-result-row"><strong>${escapeHtml(d.engineId)}${base?' · baseline':''}</strong><span>质量 ${fmtPct(m.avgQuality)}</span><span>成功 ${fmtPct(m.successRate)}</span><span>p50 ${fmtMs(m.p50LatencyMs)}</span><span>p95 ${fmtMs(m.p95LatencyMs)}</span></div><div class="lab-decision">${escapeHtml(verdict)} · ${d.promotion?.promoted?'达到 Canary 条件':'继续留在 Lab'}</div></div>`;
 }).join('');
}

function renderStoredCompetitionResults(){
 const deviceKey=deviceKeyFor(currentDeviceProfile),rows=labResults.list({deviceKey});
 if(!rows.length)return;
 pilotBenchmarkResults.innerHTML=`<div class="lab-decision">本设备最近保存的赛马成绩</div>`+rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,6).map(x=>{
  const m=x.metrics??{},base=x.meta?.baselineEngineId===x.engineId;
  const verdict=base?'基线':x.meta?.comparison?.verdict==='IMPROVEMENT'?'优于基线':x.meta?.comparison?.verdict==='REGRESSION'?'退步':'接近/混合';
  return `<div><div class="lab-result-row"><strong>${escapeHtml(x.engineId)}${base?' · baseline':''}</strong><span>质量 ${fmtPct(m.avgQuality)}</span><span>成功 ${fmtPct(m.successRate)}</span><span>p50 ${fmtMs(m.p50LatencyMs)}</span><span>p95 ${fmtMs(m.p95LatencyMs)}</span></div><div class="lab-decision">${escapeHtml(verdict)} · ${x.promotion?.promoted?'达到 Canary 条件':'继续留在 Lab'}</div></div>`;
 }).join('');
}

function fmtPct(v){return Number.isFinite(Number(v))?`${Math.round(Number(v)*100)}%`:'—'}
function fmtMs(v){return Number.isFinite(Number(v))?`${Math.round(Number(v))}ms`:'—'}

function formatExpected(e={}){return e.labels?.join(', ')||e.text||[e.target,e.intent,e.reference,e.stateOrProblem].filter(Boolean).join(' | ')||'未标注'}

 return {
  open(){if(pilotLabPanel){pilotLabPanel.hidden=false;renderPilotLab()}},
  close(){if(pilotLabPanel)pilotLabPanel.hidden=true},
  refresh(){renderPilotLab()},
 };
}

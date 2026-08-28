import {observeImage} from '../../../providers/local/local-student.js';
import {HttpPaddleOcrEngine} from '../../../providers/gateway/http-paddle-ocr.js';
import {TesseractOcrEngine} from '../../../providers/local/tesseract-ocr.js';
import {gatewayUrlFromLocation} from '../../../providers/gateway/gateway-discovery.js';
import {
  createAnnotationDraft,submitAnnotationForReview,reviewAnnotation,annotationProgress
} from '../../../core/evaluation/receipt-corpus/annotation-workflow.js';
import {
  annotationConsoleRows,acceptSuggestion,applyConsoleValue,markNotApplicable,formatGroundTruthValue
} from '../../../core/evaluation/receipt-corpus/annotation-console.js';
import {BatchAnnotationQueue,stageOf} from '../../../core/evaluation/receipt-corpus/batch-annotation-queue.js';
import {ReceiptIntakePersistence} from '../../../core/evaluation/receipt-corpus/intake-persistence.js';

const $=s=>document.querySelector(s);
const file=$('#file'),empty=$('#empty'),workspace=$('#workspace'),preview=$('#preview'),imageStatus=$('#imageStatus');
const fieldRows=$('#fieldRows'),stageBadge=$('#stageBadge'),caseIdEl=$('#caseId'),modeTitle=$('#modeTitle');
const annotatorId=$('#annotatorId'),reviewerId=$('#reviewerId'),consent=$('#consent'),redacted=$('#redacted');
const privacyWarning=$('#privacyWarning'),progressText=$('#progressText'),message=$('#message');
const annotatorActions=$('#annotatorActions'),reviewActions=$('#reviewActions'),eligibleActions=$('#eligibleActions');
const submitReview=$('#submitReview'),rejectReview=$('#rejectReview'),approveReview=$('#approveReview'),newReceipt=$('#newReceipt'),downloadJson=$('#downloadJson');
const queueList=$('#queueList'),queueCount=$('#queueCount'),resumeBatch=$('#resumeBatch');
const prevReceipt=$('#prevReceipt'),nextReceipt=$('#nextReceipt'),skipReceipt=$('#skipReceipt');

const gatewayUrl=gatewayUrlFromLocation(location);
const ocrEngines=gatewayUrl?[new HttpPaddleOcrEngine({gatewayUrl}),new TesseractOcrEngine()]:[new TesseractOcrEngine()];

const persistence=new ReceiptIntakePersistence();
let queue=new BatchAnnotationQueue(),currentUrl=null,currentDraft=null,currentFile=null,currentFilter='all';
const volatileFiles=new Map();

file.addEventListener('change',()=>openSelectedFiles());
newReceipt.addEventListener('click',()=>file.click());
resumeBatch.addEventListener('click',()=>resumePersisted());
prevReceipt.addEventListener('click',()=>{queue.previous();loadActive()});
nextReceipt.addEventListener('click',()=>{queue.next();loadActive()});
skipReceipt.addEventListener('click',()=>{queue.skip();persist();loadActive()});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  currentFilter=b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));
  renderQueue();
}));
submitReview.addEventListener('click',()=>submitForReview());
rejectReview.addEventListener('click',()=>review('reject'));
approveReview.addEventListener('click',()=>review('approve'));
downloadJson.addEventListener('click',()=>exportGroundTruth());

async function openSelectedFiles(){
  const files=[...(file.files??[])];if(!files.length)return;
  if(!queue.items.length)queue=new BatchAnnotationQueue({sessionId:`batch-${Date.now()}`});
  for(let i=0;i<files.length;i++){
    const f=files[i],id=uniqueCaseId(f,i);
    volatileFiles.set(id,f);
    queue.add({caseId:id,fileName:f.name,fileType:f.type,fileSize:f.size,imageRef:`images/${safeStem(f.name)}.redacted${extensionOf(f.name)}`});
  }
  file.value='';
  empty.hidden=true;workspace.hidden=false;
  persist();renderQueue();
  if(!currentDraft)await loadActive();
}

async function loadActive(){
  const item=queue.active();if(!item){resetConsole(false);return}
  currentDraft=item.draft;
  caseIdEl.textContent=item.caseId;
  const f=volatileFiles.get(item.caseId);
  currentUrl&&URL.revokeObjectURL(currentUrl);currentUrl=null;
  if(f){currentFile=f;currentUrl=URL.createObjectURL(f);preview.src=currentUrl}
  else{currentFile=null;preview.removeAttribute('src')}
  empty.hidden=true;workspace.hidden=false;
  if(item.draft){
    imageStatus.textContent=f?'已恢复标注进度':'标注进度已恢复 · 请重新选择原图片以查看图像';
    render();return;
  }
  if(!f){
    imageStatus.textContent='待处理 · 原图片不会写入 LocalStorage';
    currentDraft=null;fieldRows.innerHTML='';renderQueue();return;
  }
  imageStatus.textContent='Student 正在看…';message.hidden=true;
  try{
    const obs=await observeImage(f,{ocrEngines,onProgress:m=>{
      if(m?.status==='engine-failed')imageStatus.textContent=`${m.engineId} 不可用，正在自动回退…`;
      else if(m?.progress!=null)imageStatus.textContent=`正在读取 ${Math.max(1,Math.round(m.progress*100))}%`;
    }});
    currentDraft=createAnnotationDraft({
      caseId:item.caseId,imageRef:item.imageRef,studentObservation:obs,receiptType:'unknown',
      difficulty:inferDifficulty(obs),annotatorId:annotatorId.value.trim()||null,
      provenance:{source:'user-provided',consentConfirmed:false},
    });
    queue.attachDraft(item.caseId,currentDraft);
    imageStatus.textContent='Student 已预填 · 等待人工确认';
    persist();render();
  }catch(error){
    queue.fail(item.caseId,error?.code??error?.message??'OCR_FAILED');
    imageStatus.textContent='Student 没有可靠读出';showMessage(humanize(error));persist();renderQueue();
  }
}

function resumePersisted(){
  const saved=persistence.load();if(!saved)return;
  queue=BatchAnnotationQueue.fromSnapshot(saved);
  empty.hidden=true;workspace.hidden=false;
  loadActive();
}

function persist(){
  persistence.save(queue.snapshot());
  renderQueue();
}

function renderQueue(){
  if(!queueList)return;
  const rows=queue.list({stage:currentFilter});
  queueCount.textContent=`${queue.items.length} 张`;
  queueList.innerHTML=rows.map(x=>`<button class="queue-item ${x.caseId===queue.activeCaseId?'active':''}" data-case="${esc(x.caseId)}"><strong>${esc(x.fileName||x.caseId)}</strong><small>${stageLabel(stageOf(x))}</small></button>`).join('');
  queueList.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>{queue.select(b.dataset.case);loadActive()}));
}

function stageLabel(s){return ({pending:'待识别',annotation:'待标注',review:'待复核',eligible:'已通过',error:'识别失败',skipped:'已跳过'})[s]??s}

function render(){
  if(!currentDraft)return;
  caseIdEl.textContent=currentDraft.caseId;
  stageBadge.textContent=currentDraft.workflow.stage.toUpperCase();
  const rows=annotationConsoleRows(currentDraft);
  fieldRows.innerHTML=rows.map(row=>renderRow(row)).join('');
  fieldRows.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',onRowAction));
  fieldRows.querySelectorAll('input[data-field]').forEach(input=>{
    input.addEventListener('change',()=>{
      try{
        currentDraft=applyConsoleValue(currentDraft,input.dataset.field,input.value,{annotatorId:annotatorId.value.trim()||null});
        queue.attachDraft(currentDraft.caseId,currentDraft);persist();render();
      }catch(error){showMessage(humanize(error));render()}
    });
  });
  const p=annotationProgress(currentDraft);
  progressText.textContent=`已确认 ${p.confirmed}/${p.total}${p.unresolved.length?` · 未确认：${p.unresolved.map(labelFor).join('、')}`:' · 全部字段已处理'}`;
  const findings=currentDraft.workflow.sensitiveTextFindingCount??0;
  privacyWarning.hidden=findings===0;
  privacyWarning.textContent=findings?`Student 在 OCR 文字中发现 ${findings} 处潜在敏感信息（${currentDraft.workflow.sensitiveTextFindingTypes.join(' / ')}）。这只是文字提示，仍必须人工检查图片本身。`:'';
  const stage=currentDraft.workflow.stage;
  annotatorActions.hidden=stage!=='annotation';
  reviewActions.hidden=stage!=='review';
  eligibleActions.hidden=stage!=='eligible';
  modeTitle.textContent=stage==='review'?'Reviewer 复核':stage==='eligible'?'已进入候选测试库':'人工标注';
}

function renderRow(row){
  const suggestion=row.suggestion?.value!=null?formatGroundTruthValue(row.field,row.suggestion.value):'未识别';
  const confidence=row.suggestion?.value!=null?` · ${Math.round((row.suggestion.confidence??0)*100)}%`:'';
  const value=formatGroundTruthValue(row.field,row.value??row.suggestion?.value);
  const state=row.status==='confirmed'?'已确认':row.status==='not_applicable'?'不适用':'待确认';
  return `<div class="annotation-row ${row.critical?'critical':''}">
    <div class="field-label"><strong>${esc(row.label)}</strong><small>${esc(state)}</small></div>
    <div class="field-edit">
      <input data-field="${esc(row.field)}" value="${esc(value)}" placeholder="留空 = 未确认" ${currentDraft.workflow.stage!=='annotation'?'disabled':''}>
      <div class="suggestion">Student：${esc(suggestion)}${confidence}</div>
    </div>
    <div class="row-actions">
      <button data-action="accept" data-field="${esc(row.field)}" class="${row.confirmed?'confirmed':''}" ${currentDraft.workflow.stage!=='annotation'||row.suggestion?.value==null?'disabled':''}>确认</button>
      <button data-action="na" data-field="${esc(row.field)}" ${currentDraft.workflow.stage!=='annotation'?'disabled':''}>不适用</button>
    </div>
  </div>`;
}

function onRowAction(e){
  if(!currentDraft||currentDraft.workflow.stage!=='annotation')return;
  const {action,field}=e.currentTarget.dataset;
  try{
    if(action==='accept')currentDraft=acceptSuggestion(currentDraft,field,{annotatorId:annotatorId.value.trim()||null});
    if(action==='na')currentDraft=markNotApplicable(currentDraft,field,{annotatorId:annotatorId.value.trim()||null});
    queue.attachDraft(currentDraft.caseId,currentDraft);persist();render();
  }catch(error){showMessage(humanize(error))}
}

function submitForReview(){
  try{
    currentDraft=submitAnnotationForReview(currentDraft,{
      annotatorId:annotatorId.value.trim()||null,
      consentConfirmed:consent.checked,
      imageRedactionConfirmed:redacted.checked,
    });
    queue.attachDraft(currentDraft.caseId,currentDraft);persist();showMessage('已提交 Reviewer。Student 建议仍不会替代人工 Ground Truth。');
    render();
  }catch(error){showMessage(humanize(error))}
}

function review(decision){
  try{
    currentDraft=reviewAnnotation(currentDraft,{
      reviewerId:reviewerId.value.trim()||null,
      decision,
    });
    queue.attachDraft(currentDraft.caseId,currentDraft);persist();showMessage(decision==='approve'?'Reviewer 已批准。此 Ground Truth 现在符合 Benchmark 准入条件，可导出 JSON。':'已退回标注，不会进入 Benchmark。');
    render();
  }catch(error){showMessage(humanize(error))}
}

function exportGroundTruth(){
  if(!currentDraft||currentDraft.workflow.stage!=='eligible')return;
  const clean=JSON.parse(JSON.stringify(currentDraft));
  for(const value of Object.values(clean.fields??{}))delete value.suggestion;
  delete clean.workflow;
  const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`${clean.caseId}.ground-truth.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function resetConsole(openPicker=false){
  currentUrl&&URL.revokeObjectURL(currentUrl);currentUrl=null;currentDraft=null;currentFile=null;
  preview.removeAttribute('src');workspace.hidden=true;empty.hidden=false;fieldRows.innerHTML='';message.hidden=true;
  consent.checked=false;redacted.checked=false;
  resumeBatch.hidden=!persistence.load();
  if(openPicker)setTimeout(()=>file.click(),0);
}

function inferDifficulty(obs){
  const q=obs?.observations?.find(x=>x.kind==='image_preprocessing')?.quality;
  const score=Number(q?.score);
  if(Number.isFinite(score)){if(score<.45)return 'hard';if(score<.7)return 'medium';return 'easy'}
  return 'unknown';
}
function makeCaseId(f){return `mx-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${safeStem(f.name).slice(0,28)}`}
function uniqueCaseId(f,index=0){
  const base=makeCaseId(f);let id=index?`${base}-${index+1}`:base,n=2;
  while(queue.get(id))id=`${base}-${n++}`;
  return id;
}
function safeStem(name){return String(name||'receipt').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'receipt'}
function extensionOf(name){const m=String(name||'').match(/\.(jpe?g|png|webp)$/i);return m?`.${m[1].toLowerCase().replace('jpeg','jpg')}`:'.jpg'}
function labelFor(k){return ({merchant:'COMERCIO',date:'FECHA',subtotal:'SUBTOTAL',tax:'IVA',discount:'DESCUENTO',total:'TOTAL',cash:'EFECTIVO',change:'CAMBIO'})[k]??k}
function showMessage(text){message.hidden=false;message.textContent=text}
function humanize(error){
  const code=String(error?.message??error);
  if(code.startsWith('CRITICAL_FIELDS_UNRESOLVED'))return 'FECHA 和 TOTAL 必须由人工确认后才能提交复核。';
  if(code==='CONSENT_CONFIRMATION_REQUIRED')return '请先确认这张票据可用于本地测试库。';
  if(code==='IMAGE_REDACTION_CONFIRMATION_REQUIRED')return '请人工检查图片并确认敏感信息已经遮挡或不存在。';
  if(code==='ANNOTATOR_REQUIRED')return '请填写标注员。';
  if(code==='REVIEWER_REQUIRED')return '请填写复核员。';
  if(code.startsWith('INVALID_MONEY_VALUE'))return '金额格式无法识别，请输入例如 656.38。';
  return code;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

resumeBatch.hidden=!persistence.load();

/**
 * Converts a residual problem into provider-neutral specialist capabilities.
 * It never names a vendor and never executes a provider.
 */
const TASK_CAPS={
  complex_problem_decomposition:['complex_problem_decomposition','frontier_reasoning'],
  current_fact:['current_web_search','source_citations'],
  current_price:['current_retail_data','current_web_search'],
  current_availability:['current_retail_data','current_web_search'],
  local_discovery:['local_search','location_distance'],
  visual_residual:['visual_reasoning'],
  text_residual:['ocr_reasoning'],
  deep_reasoning:['frontier_reasoning'],
  coding:['coding_reasoning'],
  long_document:['long_document_reasoning'],
  translation:['translation'],
  official_fact:['official_source_retrieval','source_citations'],
  professional_fact:['professional_database','source_citations'],
};

export function planSpecialistCapabilities({task={},residual={},freshness={},evidencePolicy={}}={}){
  const kind=classify(task,residual,freshness,evidencePolicy);
  const required=[...(TASK_CAPS[kind]??['frontier_reasoning'])];
  if(task.requiresImages||residual.requiresImage)required.push('vision_input');
  if(task.requiresDocuments||residual.requiresDocument)required.push('document_input');
  if(freshness.required&&!required.includes('current_web_search'))required.push('current_web_search');
  if(evidencePolicy.requireCitations&&!required.includes('source_citations'))required.push('source_citations');
  return {schemaVersion:1,kind,requiredCapabilities:[...new Set(required)],providerNeutral:true,principle:'SELECT_CAPABILITY_NOT_BRAND'};
}

function classify(task,residual,freshness,evidencePolicy){
  const h=`${task.type??''} ${task.userIntent??''} ${residual.type??''} ${residual.question??''}`.toLowerCase();
  if(/price|多少钱|价格|哪里买/.test(h))return 'current_price';
  if(/availability|stock|库存|有货/.test(h))return 'current_availability';
  if(/nearby|附近|距离|地图|多远|closest|local discovery/.test(h))return 'local_discovery';
  if(/law|legal|regulation|official|government|法规|法律|规定/.test(h)||evidencePolicy.officialRequired)return 'official_fact';
  if(/medical|professional database|专业数据库/.test(h)||evidencePolicy.professionalRequired)return 'professional_fact';
  if(/code|coding|program|代码|编程/.test(h))return 'coding';
  if(/document|pdf|long context|长文档/.test(h))return 'long_document';
  if(/translate|translation|翻译/.test(h))return 'translation';
  if(/ocr|text|文字|标签/.test(h))return 'text_residual';
  if(/visual|image|variant|identity|图片|图像|型号|款式/.test(h)||residual.requiresImage)return 'visual_residual';
  if(freshness.required||task.realtimeRequired||task.webSearchRequired)return 'current_fact';
  return 'deep_reasoning';
}

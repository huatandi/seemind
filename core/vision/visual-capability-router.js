import {visualEvidenceAtLeast} from './visual-evidence-ladder.js';

export const VISUAL_CAPABILITIES=Object.freeze([
  'ocr_text','document_structure','object_identity','specific_identity','scene_context','color_state',
  'component_parts','spatial_relationships','anomaly_inspection','barcode_qr',
  'visual_grounding','general_vision',
]);

export function routeVisualCapabilities({observation={},userQuestion='',speechEvidence=null,availableCapabilities=[]}={}){
  observation=observation??{};
  const q=String(userQuestion||speechEvidence?.rawText||'').trim();
  const type=String(observation.detectedType??'unknown');
  const text=findObservation(observation,'ocr')?.rawText??observation.extractedText??'';
  const regions=findRegions(observation);
  const requested=[];
  const reasons=[];

  const add=(cap,priority,reason,required=true)=>{
    const existing=requested.find(x=>x.capability===cap);
    if(existing){existing.priority=Math.min(existing.priority,priority);existing.reasons.push(reason);existing.required ||= required;return}
    requested.push({capability:cap,priority,reasons:[reason],required});
  };

  if(isDocumentLike(type,text)){add('ocr_text',1,'document_or_text_evidence');add('document_structure',2,'document_layout_or_fields')}
  if(/条码|二维码|barcode|qr\b/i.test(q))add('barcode_qr',1,'explicit_barcode_or_qr_request');
  if(/什么|是什么|哪个|识别|what is|qué es|que es/i.test(q)||type==='unknown')add('object_identity',1,'identity_question_or_unknown_type');
  if(/品牌|牌子|什么牌|型号|具体型号|brand|model|marca|modelo/i.test(q))add('specific_identity',1,'explicit_brand_or_model_identity_request');
  if(/哪里|环境|周围|场景|在哪|where|scene|entorno/i.test(q)||type==='unknown')add('scene_context',3,'scene_context_may_disambiguate');
  if(/红灯|绿灯|颜色|亮|灭|闪|状态|color|light|indicator|estado/i.test(q))add('color_state',1,'state_or_color_question');
  if(/零件|部件|接口|线|插头|按钮|盖子|part|component|cable|connector|button/i.test(q))add('component_parts',1,'component_level_question');
  if(/左|右|上面|下面|旁边|之间|连接|接错|left|right|above|below|between|connected/i.test(q))add('spatial_relationships',1,'spatial_or_relationship_question');
  if(/异常|坏|故障|漏|裂|烧|变形|损坏|不工作|error|fault|broken|leak|damage/i.test(q)||(speechEvidence?.symptoms?.length??0)>0)add('anomaly_inspection',1,'troubleshooting_or_anomaly_signal');
  if((speechEvidence?.references??[]).some(x=>x.requiresVisualGrounding||['this_region','that_region','right_side','left_side','red_indicator','green_indicator','two_objects'].includes(x.type)))add('visual_grounding',1,'language_reference_requires_region_binding');

  if(!requested.length)add('general_vision',2,'no_specialized_visual_path_selected');
  const specialized=requested.filter(x=>x.capability!=='general_vision');
  if(type==='unknown'||specialized.some(x=>!isCapabilityAvailable(x.capability,availableCapabilities,observation))){
    add('general_vision',4,'specialized_local_evidence_may_be_insufficient',false);
  }

  requested.sort((a,b)=>a.priority-b.priority||a.capability.localeCompare(b.capability));
  const routed=requested.map(x=>({
    ...x,
    available:isCapabilityAvailable(x.capability,availableCapabilities,observation),
    source:capabilitySource(x.capability,availableCapabilities,observation),
  }));
  const missing=routed.filter(x=>x.required&&!x.available).map(x=>x.capability);
  const local=routed.filter(x=>x.available).map(x=>x.capability);
  return {
    schemaVersion:1,
    strategy:'capability_first',
    detectedType:type,
    requested:routed,
    localCapabilities:local,
    missingCapabilities:missing,
    needsVisionTeacher:missing.some(x=>['object_identity','specific_identity','scene_context','color_state','component_parts','spatial_relationships','anomaly_inspection','general_vision'].includes(x)),
    needsMoreVisualEvidence:missing.includes('visual_grounding')&&regions.length===0,
    principle:'Route by the visual subproblem, not by a single all-purpose image model.',
  };
}

function isCapabilityAvailable(cap,available,o){
  if(available.includes(cap))return true;
  if(cap==='ocr_text')return Boolean(findObservation(o,'ocr'));
  if(cap==='document_structure')return Boolean(findObservation(o,'structured_facts')||findObservation(o,'receipt_fields'));
  if(cap==='visual_grounding')return findRegions(o).length>0;
  if(cap==='color_state')return findRegions(o).some(r=>(r.tags??[]).some(t=>/^color:|indicator/i.test(t)));
  if(cap==='object_identity')return visualEvidenceAtLeast(o,'category',{minConfidence:.5})||findRegions(o).some(r=>r.objectType&&Number(r.confidence??0)>=.5);
  if(cap==='specific_identity')return visualEvidenceAtLeast(o,'brand',{minConfidence:.7});
  if(cap==='component_parts')return findRegions(o).some(r=>r.regionType==='part'||r.objectType);
  if(cap==='spatial_relationships')return findRegions(o).length>=2;
  if(cap==='anomaly_inspection')return Boolean(findObservation(o,'visual_anomalies'));
  if(cap==='scene_context')return Boolean(findObservation(o,'scene_context'))||(findGeneralVision(o).some(g=>(g.scene??[]).some(x=>x.label&&Number(x.confidence??0)>0)));
  if(cap==='barcode_qr')return Boolean(findObservation(o,'barcode_qr'));
  if(cap==='general_vision')return Boolean(findObservation(o,'general_vision'));
  return false;
}
function capabilitySource(cap,available,o){
  if(available.includes(cap))return 'registered_local_capability';
  return isCapabilityAvailable(cap,[],o)?'observation_evidence':null;
}
function isDocumentLike(type,text){return /receipt|invoice|document|ticket|bank|factura/i.test(type)||String(text).trim().length>=24}
function findObservation(o,kind){return (o?.observations??[]).find(x=>x.kind===kind)}
function findRegions(o){return (o?.observations??[]).filter(x=>x.kind==='visual_regions').flatMap(x=>x.regions??[])}
function findGeneralVision(o){return (o?.observations??[]).filter(x=>x.kind==='general_vision')}

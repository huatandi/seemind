import test from 'node:test';
import assert from 'node:assert/strict';
import {routeVisualCapabilities} from '../core/vision/visual-capability-router.js';
import {createGeneralVisionObservation,generalVisionToVisualRegions} from '../core/vision/general-vision-contract.js';
import {buildVisualAnalysisPlan} from '../core/vision/visual-analysis-plan.js';
import {buildVisualRegionEvidence} from '../core/grounding/region-evidence.js';

function obs({type='unknown',text='',regions=[],extra=[]}={}){
 return {detectedType:type,extractedText:text,observations:[
  ...(text?[{kind:'ocr',rawText:text,blocks:[]}]:[]),
  ...(regions.length?[{kind:'visual_regions',regions}]:[]),...extra
 ]};
}
test('document image routes to OCR and document structure',()=>{
 const r=routeVisualCapabilities({observation:obs({type:'receipt',text:'TOTAL 100.00 FECHA 25/08/2026'})});
 assert.ok(r.requested.some(x=>x.capability==='ocr_text'));
 assert.ok(r.requested.some(x=>x.capability==='document_structure'));
});
test('unknown image requests object identity, scene context and general vision',()=>{
 const r=routeVisualCapabilities({observation:obs(),userQuestion:'这是什么？'});
 assert.ok(r.requested.some(x=>x.capability==='object_identity'));
 assert.ok(r.requested.some(x=>x.capability==='scene_context'));
 assert.ok(r.requested.some(x=>x.capability==='general_vision'));
 assert.equal(r.needsVisionTeacher,true);
});
test('red blinking light asks for color/state and anomaly inspection',()=>{
 const r=routeVisualCapabilities({observation:obs({type:'device'}),userQuestion:'这个红灯一直闪，是不是坏了？'});
 assert.ok(r.requested.some(x=>x.capability==='color_state'));
 assert.ok(r.requested.some(x=>x.capability==='anomaly_inspection'));
});
test('component and spatial question routes to parts plus relationships',()=>{
 const r=routeVisualCapabilities({observation:obs({type:'device'}),userQuestion:'这两根线哪个接错了？'});
 assert.ok(r.requested.some(x=>x.capability==='component_parts'));
 assert.ok(r.requested.some(x=>x.capability==='spatial_relationships'));
});
test('existing semantic regions can satisfy local identity and color state capability',()=>{
 const regions=[{id:'led',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.7,y:.2,width:.05,height:.05},tags:['indicator','color:red']}];
 const r=routeVisualCapabilities({observation:obs({type:'device',regions}),userQuestion:'右边红灯是什么？'});
 assert.ok(r.localCapabilities.includes('object_identity'));
 assert.ok(r.localCapabilities.includes('color_state'));
});
test('general vision contract keeps anomaly as observation not diagnosis',()=>{
 const g=createGeneralVisionObservation({providerId:'mock',anomalies:[{label:'dark fluid trace',confidence:.72}],confidence:.7});
 assert.equal(g.policy.anomalyIsObservationNotDiagnosis,true);
 assert.equal(g.anomalies[0].status,'candidate');
});
test('general vision regions adapt into common visual region contract',()=>{
 const g=createGeneralVisionObservation({providerId:'mock',regions:[{id:'cap',objectType:'cap',confidence:.9,bbox:{x:.1,y:.2,width:.2,height:.2},tags:['part']}]});
 const r=generalVisionToVisualRegions(g);
 assert.equal(r[0].source,'mock');
 assert.equal(r[0].objectType,'cap');
});
test('region evidence directly consumes general vision regions',()=>{
 const g=createGeneralVisionObservation({providerId:'mock',regions:[{id:'cap',objectType:'cap',confidence:.9,bbox:{x:.1,y:.2,width:.2,height:.2},tags:['part']}]});
 const v=buildVisualRegionEvidence(obs({type:'device',extra:[g]}));
 assert.ok(v.regions.some(x=>x.id==='cap'&&x.source==='mock'));
});
test('analysis plan defers missing visual capability to vision teacher',()=>{
 const p=buildVisualAnalysisPlan({observation:obs(),userQuestion:'这是什么东西？'});
 assert.equal(p.escalation.needed,true);
 assert.ok(p.escalation.preferredKinds.includes('vision'));
 assert.ok(p.steps.some(x=>x.capability==='object_identity'&&x.execution==='defer'));
});
test('router does not force all-purpose vision when local specialized capability is enough',()=>{
 const regions=[{id:'led',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.7,y:.2,width:.05,height:.05},tags:['indicator','color:red']}];
 const r=routeVisualCapabilities({observation:obs({type:'device',regions}),userQuestion:'红灯是什么？'});
 const general=r.requested.find(x=>x.capability==='general_vision');
 assert.ok(!general || general.required===false);
});

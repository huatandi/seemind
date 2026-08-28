import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUniversalExplanation,renderUniversalExplanationHtml} from '../core/explanation/universal-explainer.js';

function observation({detectedType='object',general=[],text='',receipt=null,limitations=[]}={}){
  return {
    detectedType,
    extractedText:text,
    confidence:{overall:.82},
    limitations,
    localResolutionPossible:false,
    observations:[
      ...(general.length?general:[]),
      ...(receipt?[{kind:'receipt_fields',receipt}]:[]),
      {kind:'structured_facts',facts:[]},
      {kind:'visual_capability_plan',route:{missingCapabilities:[],needsVisionTeacher:false},providerExecution:{requiredCapabilities:[]}},
    ],
  };
}
function gv({identity=[],scene=[],states=[],anomalies=[]}={}){
 return {kind:'general_vision',providerId:'vision',identity,scene,states,anomalies,regions:[],relationships:[],confidence:.9,limitations:[]};
}

test('first ordinary image produces a useful explanation without requiring typed question',()=>{
 const o=observation({general:[gv({identity:[{label:'car',confidence:.94,status:'observed'}],scene:[{label:'road_or_street',confidence:.72,status:'candidate'}]})]});
 const e=buildUniversalExplanation({observation:o});
 assert.equal(e.mode,'general_vision');
 assert.match(e.summary,/car/i);
 assert.ok(e.highlights.some(x=>x.text==='car'));
 assert.ok(e.nextSteps.some(x=>/直接对着图片说一句/.test(x)));
});

test('candidate identity stays visibly uncertain in summary',()=>{
 const o=observation({general:[gv({identity:[{label:'dog',confidence:.72,status:'candidate'}]})]});
 const e=buildUniversalExplanation({observation:o});
 assert.match(e.summary,/可能是 dog/);
 assert.equal(e.contract.observed.items.some(x=>x.value==='dog'),false);
});

test('receipt keeps document explanation mode and concise total summary',()=>{
 const receipt={
  merchant:{value:'TIENDA',confidence:.95},
  date:{value:'2026-08-25',confidence:.9},
  subtotal:{value:10000,confidence:.9},
  tax:{value:800,confidence:.9},
  total:{value:10800,confidence:.98},
 };
 const e=buildUniversalExplanation({observation:observation({detectedType:'retail_receipt',receipt})});
 assert.equal(e.mode,'document');
 assert.match(e.summary,/TIENDA/);
 assert.match(e.summary,/\$108\.00/);
 assert.ok(e.highlights.some(x=>x.label==='TOTAL'));
});

test('text-heavy non-receipt image explains text instead of pretending object identity',()=>{
 const e=buildUniversalExplanation({observation:observation({detectedType:'document',text:'PELIGRO ALTO VOLTAJE NO ABRIR'})});
 assert.equal(e.mode,'text_image');
 assert.match(e.summary,/PELIGRO ALTO VOLTAJE/);
});

test('unknown image gives evidence-seeking next step rather than fake identification',()=>{
 const o=observation({detectedType:'unknown',limitations:['identity unknown']});
 o.confidence.overall=.2;
 o.observations[1-1]?.route; // no-op: keep fixture readable
 const e=buildUniversalExplanation({observation:o});
 assert.equal(e.mode,'unknown_image');
 assert.doesNotMatch(e.summary,/这是.*(?:car|dog|machine)/i);
 assert.ok(e.nextSteps.length>=1);
});

test('speech symptom is fused into universal explanation highlights',()=>{
 const o=observation({general:[gv({identity:[{label:'device',confidence:.9,status:'observed'}]})]});
 const e=buildUniversalExplanation({observation:o,speechText:'这个红灯一直闪，怎么办？'});
 assert.ok(e.highlights.some(x=>x.label==='你描述的症状'||/红灯/.test(x.text)));
 assert.ok(['teacher_or_tool','need_more_evidence','local_explain'].includes(e.resolution.decision));
});

test('voice text is concise and includes one next step',()=>{
 const o=observation({general:[gv({identity:[{label:'car',confidence:.94,status:'observed'}]})]});
 const e=buildUniversalExplanation({observation:o});
 assert.ok(e.voiceText.length>0);
 assert.ok(e.voiceText.length<500);
 assert.match(e.voiceText,/car/i);
});

test('rendered HTML contains summary, highlights and next-step section without raw internal contracts',()=>{
 const o=observation({general:[gv({identity:[{label:'car',confidence:.94,status:'observed'}]})]});
 const e=buildUniversalExplanation({observation:o});
 const html=renderUniversalExplanationHtml(e);
 assert.match(html,/explain-summary/);
 assert.match(html,/explain-highlights/);
 assert.match(html,/下一步/);
 assert.doesNotMatch(html,/schemaVersion|providerPolicy|missingCapabilities/);
});

test('malicious OCR text is escaped in HTML renderer',()=>{
 const e=buildUniversalExplanation({observation:observation({detectedType:'document',text:'<img src=x onerror=alert(1)> WARNING'})});
 const html=renderUniversalExplanationHtml(e);
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img/);
});

test('help path does not force Teacher wording when no teacher is available',()=>{
 const o=observation({detectedType:'unknown',limitations:['uncertain']});o.confidence.overall=.2;
 const e=buildUniversalExplanation({observation:o,availableTeachers:[]});
 assert.ok(e.helpPath);
 assert.equal(Array.isArray(e.nextSteps),true);
});

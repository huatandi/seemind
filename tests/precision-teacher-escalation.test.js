import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrecisionEscalation} from '../core/collaboration/precision-escalation.js';
import {compileTaskPackage} from '../core/compiler/task-package-compiler.js';
import {sanitizeTaskPackage} from '../core/privacy/task-package-sanitizer.js';

const collaboration={
 known:[{field:'brand',value:'Mobil 1',confidence:.97}],
 uncertain:[{field:'variant',value:'Advanced Fuel Economy',confidence:.66,reason:'medium_confidence'}],
 unknown:[{field:'viscosity',reason:'unresolved'}],
 limitations:['small label text'],
 focus:[{field:'variant',bbox:{x:.2,y:.3,w:.4,h:.2},reason:'verify'}]
};

test('precision escalation asks Teacher only for residual gap and preserves reliable Student work',()=>{
 const x=buildPrecisionEscalation({collaboration,observation:{confidence:{overall:.78}}});
 assert.equal(x.residualOnly,true);
 assert.equal(x.policy.redoReliableWork,false);
 assert.deepEqual(x.unresolved.missingFields,['viscosity']);
 assert.ok(x.request.fields.includes('variant'));
 assert.equal(x.focus.bbox.x,.2);
 assert.ok(!x.request.fields.includes('brand'));
});

test('conflicting Student evidence is explicitly classified instead of averaged away',()=>{
 const x=buildPrecisionEscalation({collaboration:{uncertain:[{field:'model',value:'ZX-500',confidence:.8,reason:'arithmetic_conflict'}],unknown:[],limitations:[],focus:[]}});
 assert.equal(x.evidenceGap,'EVIDENCE_CONFLICT');
 assert.deepEqual(x.unresolved.conflictFields,['model']);
 assert.equal(x.policy.verifyBeforeAccept,true);
});

test('compiled Teacher package carries precision residual contract',()=>{
 const receipt={merchant:{id:'m',field:'merchant',value:'SHOP',confidence:.95},date:{id:'d',field:'date',value:null,confidence:0}};
 const p=compileTaskPackage({task:{type:'question_about_observation'},observation:{detectedType:'receipt_candidate',confidence:{overall:.75},limitations:['date unclear']},receipt,userIntent:'确认日期'});
 assert.equal(p.precisionEscalation.residualOnly,true);
 assert.ok(p.precisionEscalation.unresolved.missingFields.includes('date'));
 assert.equal(p.precisionEscalation.policy.teacherOutputIsCandidate,true);
});

test('minimum-necessary sanitizer preserves precision target but not arbitrary extra detail',()=>{
 const pkg={precisionEscalation:buildPrecisionEscalation({collaboration}),conversation:[],observations:[],evidence:[],media:[]};
 const out=sanitizeTaskPackage(pkg,{mode:'minimum_necessary'}).package.precisionEscalation;
 assert.equal(out.focus.bbox.w,.4);
 assert.equal(out.policy.sendMinimumNecessaryRegion,true);
 assert.ok(out.request.instructions.length>0);
});

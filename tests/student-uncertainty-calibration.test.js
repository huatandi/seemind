import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrateStudentUncertainty} from '../core/collaboration/uncertainty-calibration.js';

test('high raw confidence is rejected when evidence conflicts',()=>{
 const x=calibrateStudentUncertainty({confidence:.94,known:[{field:'brand'}],uncertain:[{field:'model',reason:'evidence_conflict'}]});
 assert.equal(x.overconfident,true);
 assert.equal(x.state,'OVERCONFIDENT_RISK');
 assert.ok(x.calibratedConfidence<x.rawConfidence);
});

test('student can safely know that it does not know',()=>{
 const x=calibrateStudentUncertainty({confidence:.61,known:[{field:'brand'}],unknown:[{field:'model'}],limitations:['model text unreadable']});
 assert.equal(x.overconfident,false);
 assert.equal(x.state,'KNOWS_IT_DOES_NOT_KNOW');
});

test('well supported confidence remains reliable without artificial boost',()=>{
 const x=calibrateStudentUncertainty({confidence:.91,known:[{field:'brand'},{field:'model'},{field:'size'}]});
 assert.equal(x.state,'RELIABLY_CONFIDENT');
 assert.equal(x.calibratedConfidence,.91);
 assert.equal(x.policy.neverIncreaseConfidenceFromCalibration,true);
});

test('low confidence with complete consistent evidence is flagged as teacher-waste risk',()=>{
 const x=calibrateStudentUncertainty({confidence:.66,known:[{field:'brand'},{field:'model'},{field:'size'}]});
 assert.equal(x.underconfident,true);
 assert.equal(x.state,'UNDERCONFIDENT_WASTE');
});

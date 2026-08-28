import {analyzeEvidenceGaps,directEvidenceRequest,evaluateEvidenceProgress} from '../core/resolution/evidence-request-intelligence.js';
const problem={userQuestion:'设备红灯闪，显示错误，怎么办？',intentHypotheses:[{intent:'troubleshoot',confidence:.9}],referencedObjects:[]};
const observation=text=>({extractedText:text,observations:[]});
const s1={subject:{label:'device'},attempts:[],evidence:[{kind:'visual_identity',text:'device'},{kind:'visual_state',text:'red indicator'}]};
const a1=analyzeEvidenceGaps({state:s1,problem,observation:observation('')});
const r1=directEvidenceRequest({analysis:a1,state:s1});
const s2={...s1,evidence:[...s1.evidence,{kind:'ocr_text',text:'MODEL: MX-100'}]};
const a2=analyzeEvidenceGaps({state:s2,problem,observation:observation('MODEL: MX-100')});
const s3={...s2,evidence:[...s2.evidence,{kind:'ocr_text',text:'ERROR E12'}]};
const a3=analyzeEvidenceGaps({state:s3,problem,observation:observation('MODEL: MX-100 ERROR E12')});
const progress=evaluateEvidenceProgress(a1,a3);
const checks=[
 a1.gaps[0]?.type==='model',
 /铭牌/.test(r1.request?.instruction??''),
 !a2.gaps.some(x=>x.type==='model'),
 !a3.gaps.some(x=>x.type==='error_code'),
 progress.resolved.includes('model')&&progress.resolved.includes('error_code'),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Evidence Request Intelligence Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),firstRequest:r1.request,afterNameplate:a2.gaps,afterErrorCode:a3.gaps,progress},null,2));
if(passed!==checks.length)process.exitCode=1;

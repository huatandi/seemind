const MM_SCENARIOS=Object.freeze([
 'identify_with_reference','state_or_problem','read_or_translate','how_to_or_use','compare_two_objects','safety_or_risk','followup_reference'
]);
const CONDITIONS=Object.freeze(['quiet','indoor_noise','shop_noise','street_noise','vehicle_noise','near_mic','normal_mic','far_mic']);

export function auditRealWorldCorpus(cases=[]){
 const mm=cases.filter(x=>x.modality==='multimodal');
 const voice=cases.filter(x=>x.modality==='voice');
 const scenarioCounts=count(mm,x=>x.conditions?.scenario??x.tags?.find(t=>MM_SCENARIOS.includes(t))??'unspecified');
 const languageCounts=count([...voice,...mm],x=>languageFamily(x.language));
 const conditionCounts={};
 for(const c of [...voice,...mm])for(const k of CONDITIONS)if(c.conditions?.[k]||c.tags?.includes(k))conditionCounts[k]=(conditionCounts[k]??0)+1;
 const issues=[];
 if(mm.length<10)issues.push({code:'MULTIMODAL_CASES_BELOW_PILOT_TARGET',severity:'high',have:mm.length,need:10});
 if((scenarioCounts.identify_with_reference??0)<2)issues.push({code:'REFERENCE_CASES_TOO_FEW',severity:'high'});
 if((scenarioCounts.state_or_problem??0)<2)issues.push({code:'PROBLEM_STATE_CASES_TOO_FEW',severity:'high'});
 if((scenarioCounts.followup_reference??0)<1)issues.push({code:'FOLLOWUP_CONTEXT_MISSING',severity:'medium'});
 for(const lang of ['zh','es','en'])if((languageCounts[lang]??0)<3)issues.push({code:'LANGUAGE_COVERAGE_LOW',severity:'medium',language:lang,count:languageCounts[lang]??0});
 if(!Object.keys(conditionCounts).some(k=>/noise/.test(k)))issues.push({code:'NO_NOISE_CASES',severity:'medium'});
 return {schemaVersion:1,multimodalCases:mm.length,scenarioCounts,languageCounts,conditionCounts,issues,ready:issues.every(x=>x.severity!=='high')};
}
function count(rows,keyFn){const out={};for(const x of rows){const k=keyFn(x);out[k]=(out[k]??0)+1}return out}
function languageFamily(x='auto'){const b=String(x).toLowerCase().split(/[-_]/)[0];return ['cmn','yue'].includes(b)?'zh':b}

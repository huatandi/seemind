import {calibrateStudentUncertainty} from './uncertainty-calibration.js';
const DEFAULT_CONFIDENT = 0.85;
const DEFAULT_UNCERTAIN = 0.70;

/**
 * Converts raw Student output into a compact collaboration brief for Teachers.
 * The brief separates what Student knows from what it merely suspects and tells
 * the Teacher exactly where extra attention is useful.
 */
export function createStudentBriefing({observation=null, receipt=null, userIntent='', thresholds={}}={}){
  const confident = clamp01(thresholds.confident ?? DEFAULT_CONFIDENT);
  const uncertain = clamp01(thresholds.uncertain ?? DEFAULT_UNCERTAIN);
  const fields = receipt ? receiptFields(receipt) : [];
  const known=[], uncertainItems=[], unknown=[];

  for(const item of fields){
    if(item.value == null){
      unknown.push({field:item.field, reason:'unresolved'});
      continue;
    }
    const fact={field:item.field,value:item.value,confidence:item.confidence,evidenceRef:item.id??null,rule:item.rule??null,sourceText:item.sourceText??''};
    if(item.confidence >= confident) known.push(fact);
    else if(item.confidence >= uncertain) uncertainItems.push({...fact,reason:'medium_confidence'});
    else uncertainItems.push({...fact,reason:'low_confidence'});
  }

  for(const check of receipt?.checks ?? []){
    if(check?.status==='conflicted') uncertainItems.push({field:check.id,value:check.actualMinor,confidence:0,reason:'arithmetic_conflict',expected:check.expectedMinor,deltaMinor:check.deltaMinor});
  }

  const limitations = unique([...(observation?.limitations ?? []), ...deriveLimitations(observation,unknown,uncertainItems)]);
  const questions = buildTeacherQuestions({userIntent,unknown,uncertainItems,limitations});
  const calibration=calibrateStudentUncertainty({confidence:observation?.confidence?.overall??0,known,uncertain:uncertainItems,unknown,limitations});
  const focus = buildFocusTargets({unknown,uncertainItems,receipt});

  return {
    schemaVersion:1,
    summary: summarize(observation,known,unknown,uncertainItems),
    known,
    uncertain:uncertainItems,
    unknown,
    limitations,
    teacherQuestions:questions,
    focus,
    confidence:{...(observation?.confidence ?? {})},
    calibration,
  };
}

function receiptFields(receipt){
  return ['merchant','date','subtotal','tax','total','cash','change'].map(k=>receipt?.[k]).filter(x=>x&&typeof x==='object'&&'field' in x);
}
function deriveLimitations(observation,unknown,uncertain){
  const out=[];
  if(!observation) out.push('No Student observation is available.');
  if(unknown.length) out.push(`Unresolved fields: ${unknown.map(x=>x.field).join(', ')}`);
  if(uncertain.length) out.push(`Uncertain/conflicted items: ${unique(uncertain.map(x=>x.field)).join(', ')}`);
  if((observation?.confidence?.overall ?? 0)<0.7) out.push('Overall Student confidence is low.');
  return out;
}
function buildTeacherQuestions({userIntent,unknown,uncertainItems,limitations}){
  const questions=[];
  if(userIntent) questions.push(`Primary user intent: ${String(userIntent).slice(0,500)}`);
  if(unknown.length) questions.push(`Resolve only if visually/evidentially possible: ${unknown.map(x=>x.field).join(', ')}.`);
  if(uncertainItems.length) questions.push(`Verify these uncertain/conflicted items: ${unique(uncertainItems.map(x=>x.field)).join(', ')}.`);
  if(limitations.length) questions.push('Do not fill gaps that cannot be supported by supplied or explicitly retrieved evidence.');
  return questions.slice(0,5);
}
function buildFocusTargets({unknown,uncertainItems,receipt}){
  const wanted=new Set([...unknown,...uncertainItems].map(x=>x.field));
  const targets=[];
  for(const item of receiptFields(receipt)){
    if(!wanted.has(item.field)) continue;
    targets.push({field:item.field,bbox:item.bbox??null,sourceText:item.sourceText??'',reason:item.value==null?'unresolved':'verify'});
  }
  return targets.slice(0,8);
}
function summarize(observation,known,unknown,uncertain){
  const type=observation?.detectedType??'unknown';
  return `Student detected ${type}; ${known.length} confident item(s), ${uncertain.length} uncertain item(s), ${unknown.length} unresolved item(s).`;
}
function unique(items){return [...new Set(items.filter(Boolean))]}
function clamp01(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}

const VISION_TAGS=[
 ['low_light',/low[_ -]?light|dark|night|弱光|暗光/i],
 ['blur',/blur|motion[_ -]?blur|模糊|抖动/i],
 ['far_distance',/far|distance|远景|远距离/i],
 ['multi_object',/multi[_ -]?object|crowd|多物体|多个物体/i],
 ['small_target',/small[_ -]?target|tiny|小目标/i],
 ['text_interference',/text|sign|label|文字|招牌|铭牌/i],
 ['occlusion',/occlu|遮挡/i],
];
const VOICE_TAGS=[
 ['shop_noise',/shop[_ -]?noise|商店噪声/i],
 ['street_noise',/street[_ -]?noise|街道噪声/i],
 ['vehicle_noise',/vehicle[_ -]?noise|车内噪声/i],
 ['far_mic',/far[_ -]?mic|远距离/i],
 ['mixed_language',/mixed|code[_ -]?switch|混合语言|中西|中英|西英/i],
 ['numbers',/number|amount|数字|金额/i],
 ['brand_model',/brand|model|品牌|型号/i],
];

export function analyzeFailurePatterns({sessions=[],modality=null}={}){
 const buckets=new Map(),failures=[];
 for(const session of sessions??[]){
  if(modality&&session.modality!==modality)continue;
  for(const row of ((session.results?.length?session.results:session.rows)??[])){
   const c=row.case??row.benchmarkCase??row.inputCase??{id:row.id,category:row.category,language:row.language,tags:row.tags??[],conditions:row.conditions??{},scenario:row.scenario??null};
   const score=row.score??row.scoring??{};
   const quality=Number(score.quality??row.quality??0);
   const ok=Boolean(score.ok??row.ok);
   const failed=!ok||quality<.75;
   const tags=classifyCase(c,session.modality);
   if(failed)failures.push({engineId:session.engineId,caseId:c.id??row.caseId??null,quality,tags});
   for(const tag of tags){
    const key=`${session.engineId}|${tag}`;
    const b=buckets.get(key)??{engineId:session.engineId,modality:session.modality,pattern:tag,cases:0,failures:0,qualitySum:0};
    b.cases++;b.qualitySum+=quality;if(failed)b.failures++;buckets.set(key,b);
   }
  }
 }
 const patterns=[...buckets.values()].map(x=>({...x,avgQuality:x.cases?x.qualitySum/x.cases:0,failureRate:x.cases?x.failures/x.cases:0}))
  .filter(x=>x.failures>0).sort((a,b)=>b.failureRate-a.failureRate||a.avgQuality-b.avgQuality);
 return {schemaVersion:1,modality,patterns,failures,summary:summarize(patterns)};
}

export function buildRemediationHints(analysis={}){
 return (analysis.patterns??[]).filter(x=>x.cases>=2&&x.failureRate>=.25).slice(0,12).map(x=>({
  engineId:x.engineId,pattern:x.pattern,severity:x.failureRate>=.5?'high':'medium',
  evidence:{cases:x.cases,failures:x.failures,failureRate:x.failureRate,avgQuality:x.avgQuality},
  action:hint(x.modality,x.pattern),
  principle:'Use this as routing/tuning evidence; do not retrain or promote automatically.',
 }));
}

function classifyCase(c,modality){
 const raw=[...(c.tags??[]),...Object.entries(c.conditions??{}).filter(([,v])=>v).map(([k])=>k),c.category,c.scenario].filter(Boolean).join(' ');
 const table=(modality==='voice'||c.modality==='voice')?VOICE_TAGS:VISION_TAGS;
 const out=table.filter(([,re])=>re.test(raw)).map(([id])=>id);
 const lang=String(c.language??'').toLowerCase();
 if(modality==='voice'&&/[,+/]|mixed/.test(lang))out.push('mixed_language');
 return out.length?[...new Set(out)]:['ordinary'];
}
function summarize(patterns){
 const byPattern={};
 for(const p of patterns){
  const b=byPattern[p.pattern]??{pattern:p.pattern,cases:0,failures:0};
  b.cases+=p.cases;b.failures+=p.failures;byPattern[p.pattern]=b;
 }
 return Object.values(byPattern).map(x=>({...x,failureRate:x.cases?x.failures/x.cases:0})).sort((a,b)=>b.failureRate-a.failureRate);
}
function hint(modality,pattern){
 const m={
  low_light:'Prefer the existing low-light preprocessing/vision path when this pattern is detected; collect more low-light cases before promotion.',
  blur:'Prefer fast blur detection and request a steadier/closer image when identity confidence remains low.',
  far_distance:'Prefer crop/zoom guidance before invoking heavier vision.',
  multi_object:'Prefer region/object selection before specialist recognition.',
  small_target:'Prefer crop-first analysis and avoid whole-frame heavy inference.',
  text_interference:'Keep universal vision primary; request support OCR only when text is decisive.',
  shop_noise:'Prefer the best promoted noise-robust ASR for this device; otherwise ask for closer microphone placement.',
  street_noise:'Prefer noise-robust ASR and uncertainty confirmation.',
  vehicle_noise:'Prefer noise-robust ASR and avoid silent auto-commit on close alternatives.',
  far_mic:'Prefer streaming/interim feedback and request closer microphone placement when acoustic confidence is low.',
  mixed_language:'Prefer multilingual/code-switch capable ASR and preserve alternative hypotheses.',
  numbers:'Require confirmation for low-margin numeric/amount alternatives.',
  brand_model:'Use context only as a bounded rescoring signal; never let it overpower acoustics.',
 };
 return m[pattern]??`Collect more ${pattern} cases and use the result as bounded router evidence.`;
}

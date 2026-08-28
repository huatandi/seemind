const LEVELS=Object.freeze({
  none:0,scene:1,category:2,family:3,brand:4,model_candidate:5,exact_model:6,state_anomaly:7,
});

export function classifyVisualIdentityClaim(claim={}){
  const explicit=normalizeLevel(claim.evidenceLevel??claim.level);
  if(explicit)return {level:explicit,rank:LEVELS[explicit],confidence:Number(claim.confidence??0)};
  const evidence=claim.evidence??{};
  if(evidence.exactModel===true)return result('exact_model',claim);
  if(evidence.modelCandidate===true||evidence.model)return result('model_candidate',claim);
  if(evidence.brand)return result('brand',claim);
  if(evidence.family===true)return result('family',claim);
  // Generic detector labels (DETR/COCO-style object labels) are categories, not
  // brand/model identity. Unknown providers default conservatively to category.
  return result('category',claim);
}

export function strongestVisualIdentityEvidence(observation={}){
  let best={level:'none',rank:0,confidence:0,claim:null,providerId:null};
  for(const g of (observation.observations??[]).filter(x=>x.kind==='general_vision')){
    for(const claim of g.identity??[]){
      if(!claim?.label)continue;
      const x=classifyVisualIdentityClaim(claim);
      if(x.rank>best.rank||(x.rank===best.rank&&x.confidence>best.confidence)){
        best={...x,claim,providerId:g.providerId??null};
      }
    }
  }
  return best;
}

export function visualEvidenceAtLeast(observation,level,{minConfidence=.7}={}){
  const best=strongestVisualIdentityEvidence(observation);
  return best.rank>=LEVELS[level]&&best.confidence>=minConfidence;
}

export function visualEvidenceLevels(){return {...LEVELS}}

function result(level,claim){return {level,rank:LEVELS[level],confidence:Number(claim.confidence??0)}}
function normalizeLevel(x){
  const key=String(x??'').trim().toLowerCase();
  return Object.hasOwn(LEVELS,key)?key:null;
}

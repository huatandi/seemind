import {createResolvedEntity,clamp01} from './entity.js';

export function buildIdentityVerificationPackage(taskPackage={}){
  const media=taskPackage.media??[];
  const requiredCapabilities=['reasoning',...(media.some(x=>x?.type==='image')?['vision']:[])];
  const candidates=taskPackage.entityResolution?.candidates??[];
  return {
    ...taskPackage,
    task:{...taskPackage.task,type:'entity_verification',userIntent:'Verify the exact identity of the observed entity before continuing.',requiredCapabilities,webSearchRequired:false,realtimeRequired:false,freshness:{required:false,freshnessClass:'STATIC',maxAgeMs:null,reasons:[]}},
    userIntent:'Verify the exact identity of the observed entity before continuing.',
    search:{required:false,reason:'identity_must_be_verified_first'},
    freshness:{required:false,freshnessClass:'STATIC',maxAgeMs:null,reasons:[]},
    contract:{...(taskPackage.contract??{}),id:'entity_identity_v1',version:1,requireClaims:true,requireEvidenceForFacts:true,requireIdentityProposal:true},
    identityVerification:{required:true,candidates,minimumConfidence:.82},
    instructions:[...(taskPackage.instructions??[]),
      'Your first job is entity identity verification, not price/search/advice.',
      'Return identityProposal with canonicalName, category, optional brand/model/variant/region, confidence, and evidenceRefs.',
      'Only use supplied observation/image evidence for identity. Do not invent a model number or variant.',
      'If exact identity cannot be verified, set identityProposal.status to unresolved and confidence below the threshold.'
    ],
  };
}

export function validateIdentityProposal(proposal,taskPackage={}){
  const issues=[];
  if(!proposal||typeof proposal!=='object')return {ok:false,issues:['identity_proposal_missing'],entity:null};
  const canonicalName=clean(proposal.canonicalName);
  const confidence=clamp01(proposal.confidence??0);
  const min=Number(taskPackage.identityVerification?.minimumConfidence??.82);
  const allowed=new Set([...(taskPackage.evidence??[]).map(x=>x?.id),...(taskPackage.media??[]).map(x=>x?.id)].filter(Boolean));
  const refs=[...new Set((proposal.evidenceRefs??[]).filter(x=>typeof x==='string'))];
  if(!canonicalName)issues.push('identity_name_missing');
  if(confidence<min)issues.push('identity_confidence_too_low');
  if(!refs.length)issues.push('identity_evidence_missing');
  if(refs.some(id=>!allowed.has(id)))issues.push('identity_unknown_evidence_ref');
  if(proposal.status==='unresolved')issues.push('identity_unresolved');
  if(issues.length)return {ok:false,issues,entity:null};
  const entity=createResolvedEntity({
    canonicalName,category:clean(proposal.category)||'unknown',brand:clean(proposal.brand)||null,model:clean(proposal.model)||null,
    variant:clean(proposal.variant)||null,region:clean(proposal.region)||null,aliases:proposal.aliases??[],confidence,
    status:confidence>=.9?'confirmed':'probable',evidenceRefs:refs,conflicts:[],requiresClarification:false,
    resolutionMethod:'teacher_verified_vision',
  });
  return {ok:true,issues:[],entity};
}

export function verifiedEntityCandidate(entity){
  if(!entity)return null;
  return {...entity,confidence:Math.max(.82,Number(entity.confidence)||0),resolutionMethod:'teacher_verified_vision',requiresClarification:false,conflicts:[]};
}
function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}

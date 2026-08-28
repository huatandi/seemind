import {normalizePerceptionObservation} from '../perception/perception-boundary.js';
import {extractSpeechEvidence} from './speech-evidence.js';
import {groundLanguageReferences} from '../grounding/visual-language-grounding.js';
import {buildVisualAnalysisPlan} from '../vision/visual-analysis-plan.js';

export function fuseMultimodalContext({visualObservation=null,speechText='',textInput='',conversation=[],language='auto',conversationReference=null}={}){
  const spoken=extractSpeechEvidence(speechText||textInput,{language});
  const structured=findObservation(visualObservation,'structured_facts');
  const resolution=findObservation(visualObservation,'resolution_plan');
  const visualFacts=[
    ...(structured?.facts??[]).map(f=>({
      id:f.id,category:f.category,name:f.name,value:f.value,unit:f.unit,confidence:f.confidence,status:f.status,
      source:'visual',conflicts:f.conflicts??[],
      epistemic:normalizePerceptionObservation({modality:'image',value:f.value,confidence:f.confidence,source:'structured_visual'}),
    })),
    ...generalVisionFacts(visualObservation).map(f=>({...f,
      epistemic:normalizePerceptionObservation({modality:'image',value:f.value,confidence:f.confidence,source:f.source})
    })),
  ];
  const baseReferences=spoken.references.map(ref=>groundReference(ref,visualObservation,visualFacts));
  const grounding=groundLanguageReferences({observation:visualObservation,references:baseReferences});
  let references=baseReferences.map(ref=>mergeRegionGrounding(ref,grounding.results.find(x=>sameReference(x.reference,ref))));
  references=applyCompoundGrounding(references,grounding.compounds??[]);
  const contradictions=findCrossModalContradictions({spoken,visualFacts});
  const existingVisualPlan=findObservation(visualObservation,'visual_capability_plan');
  const hasNewLanguage=Boolean(String(speechText||textInput||'').trim());
  const visualPlan=!hasNewLanguage&&existingVisualPlan
    ? {...existingVisualPlan,reused:true,reuseReason:'NO_NEW_LANGUAGE_CONTEXT'}
    : buildVisualAnalysisPlan({observation:visualObservation,userQuestion:spoken.rawText,speechEvidence:spoken,availableCapabilities:[]});
  const unsupportedClaims=[];

  return {
    schemaVersion:1,
    sessionType:'multimodal_problem',
    modalities:{
      image:Boolean(visualObservation),
      speech:Boolean(speechText),
      text:Boolean(textInput&&!speechText),
    },
    visual:{
      detectedType:visualObservation?.detectedType??'unknown',
      confidence:Number(visualObservation?.confidence?.overall??0),
      facts:visualFacts,
      limitations:[...(visualObservation?.limitations??[])],
    },
    speech:spoken,
    references,
    grounding,
    visualPlan,
    symptoms:spoken.symptoms,
    attemptedActions:spoken.attemptedActions,
    temporalContext:spoken.temporal,
    userIntent:chooseIntent(spoken,visualObservation),
    intentStatus:'PERCEPTION_HINT_ONLY',
    contradictions,
    unknowns:buildUnknowns({references,spoken,visualObservation,grounding}),
    priorTurns:(conversation??[]).slice(-8).map(t=>({role:t.role,text:t.text??t.speechText??'',modality:t.modality??(t.speechText?'speech':'text')})),
    conversationReference:conversationReference?.resolved?conversationReference:null,
    currentResolution:resolution??null,
    evidencePolicy:{
      visualAndSpeechMaySupportEachOther:true,
      perceptionProducesObservationsNotFacts:true,
      factVerificationAuthority:'EVIDENCE_LAYER',
      speechCannotCreateVisualFact:true,
      visualCannotCreateUserHistory:true,
      unresolvedReferencesRemainUnresolved:true,
      unsupportedClaims,
      finalIntentAuthority:'UNDERSTANDING_BOUNDARY',
    },
  };
}

export function buildMultimodalProblemPrompt(ctx={}){
  return {
    task:'understand_and_help_with_real_world_problem',
    instruction:'Use visual facts and user speech together. Separate observed facts, user-reported facts, inference, and unknowns. Never invent visual evidence or user history.',
    detectedType:ctx.visual?.detectedType??'unknown',
    visualFacts:ctx.visual?.facts??[],
    userSpeech:ctx.speech?.rawText??'',
    symptoms:ctx.symptoms??[],
    attemptedActions:ctx.attemptedActions??[],
    temporalContext:ctx.temporalContext??[],
    references:ctx.references??[],
    contradictions:ctx.contradictions??[],
    unknowns:ctx.unknowns??[],
    userIntent:ctx.userIntent??null,
    visualPlan:ctx.visualPlan??null,
    conversationReference:ctx.conversationReference??null,
  };
}

function chooseIntent(spoken,visual){
  const top=spoken.intentSignals?.[0];
  if(top)return {value:top.type,confidence:top.confidence,source:'speech'};
  if(spoken.symptoms?.length)return {value:'troubleshoot',confidence:.76,source:'speech_symptom'};
  if(visual?.detectedType&&visual.detectedType!=='unknown')return {value:'explain_observation',confidence:.62,source:'visual_default'};
  return {value:'identify_and_explain',confidence:.45,source:'default'};
}
function groundReference(ref,visual,facts){
  const type=ref.type;
  const candidates=[];
  if(type==='displayed_code')candidates.push(...facts.filter(f=>/code|model|reference|tracking/i.test(f.name)));
  if(type==='this_object')candidates.push(...facts.filter(f=>f.category==='identity'));
  const spatial=['this_region','that_region','right_side','left_side','upper_area','lower_area','red_indicator','green_indicator','two_objects','ordinal_1','ordinal_2','ordinal_3'].includes(type);
  return {
    ...ref,
    status:candidates.length===1?'tentative':spatial?'unresolved':'tentative',
    candidateFactIds:candidates.map(x=>x.id),
    requiresVisualGrounding:spatial||candidates.length!==1,
  };
}
function findCrossModalContradictions({spoken,visualFacts}){
  const out=[];
  // Speech-reported history is not contradicted by absence in image.
  // Only compare explicitly comparable factual claims.
  const visualCodes=visualFacts.filter(f=>/code/i.test(f.name)&&f.value!=null).map(f=>String(f.value));
  for(const ref of spoken.references??[]){
    if(ref.type==='displayed_code'&&visualCodes.length===0)out.push({kind:'reference_without_visual_fact',referenceType:ref.type,severity:'low'});
  }
  return out;
}
function buildUnknowns({references,spoken,visualObservation,grounding}){
  const out=[];
  if(!visualObservation)out.push({id:'visual.input',reason:'no_image'});
  for(const r of references)if(r.requiresVisualGrounding&&r.groundingStatus!=='resolved')out.push({id:`reference.${r.type}`,reason:'visual_grounding_required'});
  for(const c of grounding?.compounds??[])if(c.status==='unresolved')out.push({id:`compound.${c.referenceTypes.join('+')}`,reason:'compound_visual_grounding_unresolved'});
  if(spoken.uncertainSegments?.length)out.push({id:'speech.uncertain_segment',reason:'speaker_or_recognition_uncertainty'});
  return uniqueById(out);
}
function uniqueById(a){const m=new Map();for(const x of a)m.set(x.id,x);return [...m.values()]}
function findObservation(o,kind){return (o?.observations??[]).find(x=>x.kind===kind)}

function sameReference(a,b){return a?.type===b?.type&&a?.sourceText===b?.sourceText}
function mergeRegionGrounding(ref,g){
  if(!g)return ref;
  return {
    ...ref,
    groundingStatus:g.status,
    groundedRegionId:g.regionId,
    groundedBbox:g.bbox,
    groundingConfidence:g.confidence,
    groundingReason:g.reason,
    regionCandidates:g.candidates,
    requiresVisualGrounding:ref.requiresVisualGrounding&&g.status!=='resolved',
  };
}

function applyCompoundGrounding(references,compounds){
  const resolved=compounds.filter(c=>c.status==='resolved'&&c.regionId);
  return references.map(ref=>{
    const hierarchical=resolved.find(x=>x.reason==='PARENT_SCOPED_ORDINAL_EVIDENCE'&&x.referenceTypes.includes(ref.type)&&x.sourceTexts.includes(ref.sourceText));
    if(ref.groundingStatus==='resolved'&&!hierarchical)return ref;
    const c=hierarchical??resolved.find(x=>x.referenceTypes.includes(ref.type)&&x.sourceTexts.includes(ref.sourceText));
    if(!c)return ref;
    // In a parent-scoped ordinal compound, the spatial phrase selects the
    // parent while the ordinal denotes the child. Do not collapse both to the child.
    if(c.reason==='PARENT_SCOPED_ORDINAL_EVIDENCE'&&!/^ordinal_/.test(ref.type))return {
      ...ref,
      groundingStatus:'resolved',
      groundedRegionId:c.parentRegionId,
      groundingConfidence:c.confidence,
      groundingReason:'PARENT_REGION_FOR_COMPOUND',
      requiresVisualGrounding:false,
      resolvedByCompound:true,
    };
    return {
      ...ref,
      groundingStatus:'resolved',
      groundedRegionId:c.regionId,
      groundedBbox:c.bbox,
      groundingConfidence:c.confidence,
      groundingReason:c.reason,
      parentRegionId:c.parentRegionId??null,
      requiresVisualGrounding:false,
      resolvedByCompound:true,
    };
  });
}

function generalVisionFacts(observation){
  const out=[];
  const general=(observation?.observations??[]).filter(x=>x.kind==='general_vision');
  for(const g of general){
    for(const [i,x] of (g.identity??[]).entries())if(x.label)out.push({
      id:`vision.identity.${slug(x.label)}.${i+1}`,category:'identity',name:'visualObject',value:x.label,
      unit:null,confidence:Number(x.confidence??0),status:x.status??'candidate',source:'general_vision',providerId:g.providerId,conflicts:[],
    });
    for(const [i,x] of (g.scene??[]).entries())if(x.label)out.push({
      id:`vision.scene.${slug(x.label)}.${i+1}`,category:'scene',name:'sceneContext',value:x.label,
      unit:null,confidence:Number(x.confidence??0),status:x.status??'candidate',source:'general_vision',providerId:g.providerId,conflicts:[],
    });
    for(const [i,x] of (g.states??[]).entries())if(x.label)out.push({
      id:`vision.state.${slug(x.label)}.${i+1}`,category:'state',name:'visualState',value:x.label,
      unit:null,confidence:Number(x.confidence??0),status:x.status??'candidate',source:'general_vision',providerId:g.providerId,conflicts:[],
    });
  }
  return out;
}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item'}

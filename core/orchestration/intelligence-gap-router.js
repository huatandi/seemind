import {rankTeachers} from '../teacher/teacher-router.js';
import {applySpecialistExploration} from './specialist-exploration-policy.js';
import {SpecialistOutcomeStore,classifySpecialistOutcome} from './specialist-outcome-learning.js';

/**
 * Canonical production boundary for borrowing intelligence.
 * One eligibility/ranking path: Teacher Router owns provider scoring; this facade owns
 * intelligence-gap semantics, bounded exploration and the ordered failover chain.
 */
export async function routeIntelligenceGap({
  gap={},taskPackage=null,providers=[],outcomeStore=null,performanceStore=null,enabledProviderIds=null,
  localOnly=false,consent=true,exploration=false,explorationRate=.08,requestKey=''
}={}){
  const requiredCapabilities=[...new Set(gap.requiredCapabilities??taskPackage?.task?.requiredCapabilities??[])].filter(Boolean);
  if(!requiredCapabilities.length)return {status:'local_or_unknown',reason:'NO_INTELLIGENCE_GAP',selected:null,chain:[]};
  const pkg=normalizeTaskPackage(taskPackage,gap,requiredCapabilities);
  const ranked=await rankTeachers(pkg,providers,{outcomeStore,performanceStore,enabledProviderIds,localOnly,consent});
  if(!ranked.length)return {status:'unavailable',reason:'NO_ELIGIBLE_SPECIALIST',selected:null,chain:[]};
  const choice=applySpecialistExploration(ranked,{enabled:Boolean(exploration),explorationRate,requestKey});
  const selected=choice.selected??ranked[0];
  const chain=[selected,...ranked.filter(x=>x.provider.id!==selected.provider.id)].map((x,index)=>({...x,failoverRank:index+1}));
  return {schemaVersion:1,status:'ready',reason:choice.explored?'BOUNDED_EXPLORATION':'BEST_VERIFIED_FIT',
    gap:{kind:gap.kind??pkg.task?.type??'specialist',requiredCapabilities},selected,chain,explored:Boolean(choice.explored),
    policy:'CAPABILITY_AND_VERIFIED_OUTCOME_NOT_BRAND',rankingAuthority:'TEACHER_ROUTER'};
}
export function deriveIntelligenceGap({task={},answerability={},planning={}}={}){
  if(answerability?.answerable===true)return null;
  const required=[...(task.requiredCapabilities??[])].filter(Boolean);
  if(planning?.needsPlanningSpecialist&&!required.includes('complex_problem_decomposition'))required.unshift('complex_problem_decomposition');
  return required.length?{kind:task.type??'specialist',requiredCapabilities:[...new Set(required)]}:null;
}
function normalizeTaskPackage(pkg,gap,requiredCapabilities){
  if(pkg)return {...pkg,task:{...(pkg.task??{}),requiredCapabilities}};
  return {task:{type:gap.kind??'specialist',requiredCapabilities,language:gap.language??'auto'},constraints:gap.constraints??[],freshness:gap.freshness??{},safety:gap.safety??{}};
}


/**
 * Canonical outcome-learning helpers. Kept here so production has one public
 * teacher-selection surface while the statistical store remains an internal policy component.
 */
export function createTeacherOutcomeStore(seed=[]){return new SpecialistOutcomeStore(seed)}
export function learnTeacherOutcome(store,{providerId,capabilities=[],taskKind='*',technicalOk=false,verified=false,userCorrected=false,authoritativeContradiction=false,residualResolved=null,latencyMs=null,cost=null,meta={}}={}){
  if(!store?.record)return null;
  const signal=classifySpecialistOutcome({technicalOk,verified,userCorrected,authoritativeContradiction,residualResolved});
  return store.record({providerId,capabilities,taskKind,signal,latencyMs,cost,meta});
}

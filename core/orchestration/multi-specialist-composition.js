import {planSpecialistCapabilities} from './specialist-capability-plan.js';
/**
 * Builds a bounded DAG of capability-specific specialist jobs.
 * Composition is decomposition, not multi-model voting: one owner per subproblem,
 * explicit dependencies, shared verified evidence, and a final SeeMind synthesis.
 */
const MAX_JOBS=5;
export function composeSpecialistJobs({task={},student={},residuals=[],freshness={},evidencePolicy={}}={}){
  const jobs=[], add=(id,kind,capabilities,dependsOn=[],input={})=>{
    if(jobs.length>=MAX_JOBS||jobs.some(x=>x.id===id))return;
    jobs.push({id,kind,requiredCapabilities:[...new Set(capabilities)],dependsOn:[...new Set(dependsOn)],input,outputPolicy:'CANDIDATE_EVIDENCE_ONLY'});
  };
  const caps=(type,extra={})=>planSpecialistCapabilities({task:{type,...extra},freshness,evidencePolicy}).requiredCapabilities;
  const h=`${task.type??''} ${task.userIntent??''} ${task.question??''} ${residuals.map(x=>`${x.type??''} ${x.question??''}`).join(' ')}`.toLowerCase();
  const identityKnown=Boolean(student.exactIdentity||student.productId||student.barcodeIdentity);
  if(!identityKnown&&/(product|商品|型号|款式|identity|visual|image)/.test(h))
    add('identity','visual_residual',caps('visual_residual',{requiresImages:true}),[],{preserveKnown:true});
  const identityDep=jobs.some(x=>x.id==='identity')?['identity']:[];
  if(/price|价格|多少钱|划算|cheapest|哪里买/.test(h))
    add('retail','current_price',caps('current_price'),identityDep,{requiresExactIdentity:true});
  if(/nearby|附近|距离|地图|多远|closest/.test(h))
    add('local','local_discovery',caps('local_discovery'),identityDep,{requiresExactIdentity:false});
  if(/compare|区别|差别|哪个好|值得|划算|recommend|比较/.test(h)){
    const deps=jobs.filter(x=>['identity','retail','local'].includes(x.id)).map(x=>x.id);
    add('reason','deep_reasoning',caps('deep_reasoning'),deps,{useVerifiedUpstreamOnly:true});
  }
  if(freshness.required&&!jobs.some(x=>x.requiredCapabilities.includes('current_web_search')))
    add('fresh','current_fact',caps('current_fact'),identityDep,{freshnessRequired:true});
  if(evidencePolicy.officialRequired)
    add('official','official_fact',caps('official_fact'),identityDep,{officialRequired:true});
  return {schemaVersion:1,jobs,parallelGroups:parallelGroups(jobs),bounded:jobs.length<=MAX_JOBS,
    strategy:'SPECIALISTS_BY_SUBPROBLEM_NOT_MODEL_VOTING',finalSynthesisOwner:'SEEMIND'};
}
export function readySpecialistJobs(composition,completedIds=[]){
  const done=new Set(completedIds);
  return (composition?.jobs??[]).filter(j=>!done.has(j.id)&&j.dependsOn.every(x=>done.has(x)));
}
export function validateSpecialistComposition(composition){
  const jobs=composition?.jobs??[],ids=new Set(jobs.map(x=>x.id));
  if(jobs.length>MAX_JOBS||ids.size!==jobs.length)return false;
  return jobs.every(j=>j.dependsOn.every(d=>ids.has(d)&&d!==j.id))&&!hasCycle(jobs);
}
function parallelGroups(jobs){
  const pending=new Map(jobs.map(j=>[j.id,j])),done=new Set(),groups=[];
  while(pending.size){const ready=[...pending.values()].filter(j=>j.dependsOn.every(d=>done.has(d)));if(!ready.length)break;groups.push(ready.map(x=>x.id));for(const j of ready){pending.delete(j.id);done.add(j.id)}}
  return groups;
}
function hasCycle(jobs){return parallelGroups(jobs).flat().length!==jobs.length}

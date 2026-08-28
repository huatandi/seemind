import {createTaskGraph} from './task-graph.js';

export function shouldPlanTask(task={}){
  const hay=`${task.type??''} ${task.userIntent??''}`.toLowerCase();
  if(task.planRequired===true)return true;
  if((task.requiredCapabilities??[]).length>2)return true;
  return /troubleshoot|repair|diagnos|compare|research|shopping|manual|maintenance|故障|维修|诊断|比较|研究|配件|说明书|保养|哪里买/.test(hay);
}

export function planTask(task={},context={}){
  if(!shouldPlanTask(task))return createTaskGraph({task,nodes:[node('answer','resolve_task')],budget:context.budget});
  const hay=`${task.type??''} ${task.userIntent??''}`.toLowerCase();
  const caps=[...new Set(task.requiredCapabilities??[])];
  if(caps.length>2&&!/troubleshoot|repair|diagnos|维修|故障|诊断|compare|shopping|价格|哪里买|购买|配件|manual|说明书/.test(hay))return capabilityCompositionPlan(task,context,caps);
  if(/troubleshoot|repair|diagnos|维修|故障|诊断/.test(hay))return troubleshootingPlan(task,context);
  if(/compare|shopping|价格|哪里买|购买|配件/.test(hay))return comparisonPlan(task,context);
  if(/manual|说明书/.test(hay))return manualPlan(task,context);
  return researchPlan(task,context);
}


function capabilityCompositionPlan(task,context,caps){
  const wanted=new Set(caps),nodes=[];
  const add=(id,type,deps=[],meta={})=>{if(!nodes.some(n=>n.id===id))nodes.push(node(id,type,deps,meta));};
  // Identity is a prerequisite for identity-dependent retrieval/comparison, but
  // OCR/translation can still operate on visible text without exact identity.
  if(hasAny(wanted,['identify','product_understanding','food_understanding','document_understanding']))add('identify','identify_entity',[],{requiredCapabilities:['vision','reasoning']});
  if(hasAny(wanted,['ocr','read_text']))add('read','capability_step',[],{capability:'ocr',goal:'extract_visible_text',requiredCapabilities:['vision','reasoning']});
  if(wanted.has('translate'))add('translate','capability_step',nodes.some(n=>n.id==='read')?['read']:[],{capability:'translate',goal:'translate_verified_text',requiredCapabilities:['reasoning']});
  if(hasAny(wanted,['search','retrieve_current_info']))add('search','retrieve_evidence',nodes.some(n=>n.id==='identify')?['identify']:[],{requiredCapabilities:['search'],freshness:wanted.has('retrieve_current_info')?'FAST_CHANGING':null});
  if(wanted.has('compare'))add('compare','compare_options',[...['identify','search','translate'].filter(id=>nodes.some(n=>n.id===id))],{requiredCapabilities:['reasoning']});
  const finalDeps=nodes.filter(n=>!nodes.some(x=>x.dependencies.includes(n.id))).map(n=>n.id);
  add('final','final_answer',finalDeps,{requiredCapabilities:['reasoning']});
  return createTaskGraph({task,budget:context.budget,nodes});
}
function hasAny(set,values){return values.some(x=>set.has(x))}

function troubleshootingPlan(task,context){return createTaskGraph({task,budget:context.budget,nodes:[
  node('identify','identify_entity',[],{requiredCapabilities:['vision','reasoning']}),
  node('manual','retrieve_primary_manual',['identify'],{requiredCapabilities:['search'],evidenceTarget:'official_manual'}),
  node('diagnose','generate_diagnosis',['identify','manual'],{requiredCapabilities:['reasoning']}),
  node('verify','verify_diagnosis',['diagnose'],{requiredCapabilities:['search','reasoning'],evidenceTarget:'official_or_professional'}),
  node('solution','recommend_solution',['verify'],{requiredCapabilities:['reasoning']}),
  node('parts','identify_parts',['solution'],{optional:true,requiredCapabilities:['reasoning']}),
  node('prices','search_current_prices',['parts'],{optional:true,requiredCapabilities:['search'],freshness:'FAST_CHANGING'}),
  node('final','final_recommendation',['solution','prices'],{allowOptionalDependencies:true,requiredCapabilities:['reasoning']})
]});}

function comparisonPlan(task,context){return createTaskGraph({task,budget:context.budget,nodes:[
  node('identify','identify_entity',[],{requiredCapabilities:['vision','reasoning']}),
  node('specs','retrieve_specifications',['identify'],{requiredCapabilities:['search'],evidenceTarget:'official'}),
  node('prices','search_current_prices',['identify'],{requiredCapabilities:['search'],freshness:'FAST_CHANGING'}),
  node('compare','compare_options',['specs','prices'],{requiredCapabilities:['reasoning']}),
  node('final','final_recommendation',['compare'],{requiredCapabilities:['reasoning']})
]});}

function manualPlan(task,context){return createTaskGraph({task,budget:context.budget,nodes:[
  node('identify','identify_entity',[],{requiredCapabilities:['vision','reasoning']}),
  node('manual','retrieve_primary_manual',['identify'],{requiredCapabilities:['search'],evidenceTarget:'official_manual'}),
  node('final','explain_manual',['manual'],{requiredCapabilities:['reasoning']})
]});}

function researchPlan(task,context){return createTaskGraph({task,budget:context.budget,nodes:[
  node('scope','clarify_research_scope'),
  node('search','retrieve_evidence',['scope'],{requiredCapabilities:['search']}),
  node('synthesize','synthesize_evidence',['search'],{requiredCapabilities:['reasoning']}),
  node('final','final_answer',['synthesize'],{requiredCapabilities:['reasoning']})
]});}

function node(id,type,dependencies=[],metadata={}){return {id,type,dependencies,maxRetries:metadata.maxRetries??1,optional:Boolean(metadata.optional),stopCondition:metadata.stopCondition??'node_goal_satisfied',escalationCondition:metadata.escalationCondition??'evidence_insufficient_or_provider_failure',metadata}}

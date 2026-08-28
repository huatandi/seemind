export function createProblemState(input={}){
  return {
    schemaVersion:2,
    target:input.target??null,
    goal:input.goal??null,
    symptoms:[...(input.symptoms??[])],
    facts:[...(input.facts??[])],
    unknowns:[...(input.unknowns??[])],
    attemptedActions:[...(input.attemptedActions??[])],
    results:[...(input.results??[])],
    constraints:[...(input.constraints??[])],
    risk:input.risk??{level:'LOW',requiresExpert:false},
    hypotheses:[...(input.hypotheses??[])],
    nextBestAction:input.nextBestAction??null,
    routeHistory:[...(input.routeHistory??[])],
    continuity:input.continuity??{status:'unknown',entityId:null,confidence:null},
    quarantined:[...(input.quarantined??[])],
    lifecycle:input.lifecycle??{status:'investigating',generation:0,lastTransition:null},
    updatedAt:input.updatedAt??new Date().toISOString(),
  };
}

export function updateProblemState(state,{problem=null,problemSession=null,risk=null,route=null}={}){
  let next=createProblemState(state??{});
  const relation=problemSession?.lastPhotoRelationship??null;
  if(relation){
    next=applyContinuity(next,relation,problemSession);
  }

  const allowObjectMerge=!relation||!['unresolved'].includes(relation.status);
  if(problem&&allowObjectMerge){
    const currentTarget=compactTarget(problem.referencedObjects?.[0]);
    if(!next.target&&currentTarget)next.target=currentTarget;
    next.goal=problem.intentHypotheses?.[0]?.intent??next.goal;
    next.symptoms=merge(next.symptoms,(problem.symptoms??[]).map(x=>({type:x.type??'symptom',text:x.sourceText??x.text??x.type,confidence:x.confidence??null})));
    next.facts=merge(next.facts,problem.knownFacts??[]);
    next.unknowns=merge(next.unknowns,[...(problem.unknownFacts??[]),...(problem.multimodalUnknowns??[])]);
    next.attemptedActions=merge(next.attemptedActions,problem.attemptedActions??[]);
  }else if(problem&&relation?.status==='unresolved'){
    next.quarantined=appendBounded(next.quarantined,{kind:'ambiguous_problem_evidence',at:new Date().toISOString(),problem:compactProblem(problem)},6);
    next.unknowns=merge(next.unknowns,[{type:'photo_relationship',text:'当前补充图片与正在解决的对象关系尚未确认'}]);
  }

  if(problemSession&&allowObjectMerge){
    next=applyProblemLifecycle(next,problemSession);
    next.target=targetFromSession(problemSession)??next.target;
    next.goal=problemSession.goal??next.goal;
    next.symptoms=merge(next.symptoms,problemSession.symptoms??[]);
    next.facts=merge(next.facts,problemSession.evidence??[]);
    next.attemptedActions=merge(next.attemptedActions,problemSession.attempts??[]);
    next.results=merge(next.results,problemSession.attemptResults??[]);
    if(problemSession.resolution)next.results=merge(next.results,[problemSession.resolution]);
  }
  if(risk)next.risk={level:risk.level??next.risk.level,requiresExpert:Boolean(risk.requiresExpert)};
  if(route)next.routeHistory=[...next.routeHistory,{route:route.route??route,reason:route.reason??null,at:new Date().toISOString()}].slice(-12);
  next.updatedAt=new Date().toISOString();
  return next;
}

/**
 * Derive the Brain working view from the canonical ProblemSolvingSession.
 * The returned object is disposable: callers must not persist it as a second lifecycle.
 */
export function deriveBrainWorkingView({problemSession=null,problem=null,risk=null,route=null}={}){
  return updateProblemState(createProblemState(),{problem,problemSession,risk,route});
}

export function compactProblemState(state={}){
  return {
    target:state.target??null,goal:state.goal??null,
    symptoms:(state.symptoms??[]).slice(-5),facts:(state.facts??[]).slice(-8),
    unknowns:(state.unknowns??[]).slice(-6),attemptedActions:(state.attemptedActions??[]).slice(-6),
    results:(state.results??[]).slice(-4),constraints:(state.constraints??[]).slice(-6),
    risk:state.risk??null,nextBestAction:state.nextBestAction??null,
    routeHistory:(state.routeHistory??[]).slice(-6),
    continuity:state.continuity??null,
    lifecycle:state.lifecycle??null,
  };
}

function applyContinuity(state,relation,problemSession){
  const status=relation.status??'unknown';
  if(['new_object','likely_new_object'].includes(status)){
    const preservedConstraints=[...(state.constraints??[])];
    const preservedRoutes=[...(state.routeHistory??[])].slice(-4);
    const fresh=createProblemState({
      constraints:preservedConstraints,
      routeHistory:preservedRoutes,
      continuity:{status:'new_object',entityId:relation.entityId??problemSession?.activeEntitySummary?.entity?.id??null,confidence:relation.confidence??null},
    });
    return fresh;
  }
  if(['same_object','probably_same_object','same_observation'].includes(status)){
    state.continuity={status,entityId:relation.entityId??problemSession?.activeEntitySummary?.entity?.id??state.continuity?.entityId??null,confidence:relation.confidence??null};
    return state;
  }
  if(status==='unresolved'){
    state.continuity={status:'unresolved',entityId:state.continuity?.entityId??null,confidence:relation.confidence??null};
    return state;
  }
  return state;
}

function applyProblemLifecycle(state,session){
  const status=session.status??'investigating';
  const generation=session.lifecycle?.generation??state.lifecycle?.generation??0;
  const previous=state.lifecycle?.status??'investigating';
  state.lifecycle={status,generation,lastTransition:session.lifecycle?.lastTransition??state.lifecycle?.lastTransition??null};

  if(status==='resolved'){
    state.nextBestAction=null;
    state.unknowns=[];
  }else if(['paused','closed'].includes(status)){
    state.nextBestAction=null;
  }else if(status==='investigating'&&previous==='resolved'&&generation>(state.lifecycle?.generation??0)){
    state.nextBestAction=null;
  }
  return state;
}
function targetFromSession(session){
  const entity=session?.activeEntitySummary?.entity;
  if(entity)return {id:entity.id??null,label:entity.labels?.[0]??session.subject?.label??null,regionId:null};
  if(session?.subject)return session.subject;
  return null;
}
function compactTarget(x){return x?{id:x.id??null,label:x.label??x.sourceText??x.type??null,regionId:x.groundedRegionId??null}:null}
function compactProblem(p){return {userQuestion:p.userQuestion??null,intent:p.intentHypotheses?.[0]?.intent??null,symptoms:(p.symptoms??[]).slice(0,4),referencedObjects:(p.referencedObjects??[]).slice(0,3)}}
function merge(a,b){const out=[...(a??[])],seen=new Set(out.map(key));for(const x of b??[]){const k=key(x);if(!seen.has(k)){seen.add(k);out.push(x)}}return out}
function appendBounded(a,x,n){return [...(a??[]),x].slice(-n)}
function key(x){return JSON.stringify(typeof x==='string'?x:{type:x?.type??null,text:x?.text??x?.sourceText??null,id:x?.id??null,value:x?.value??null,normalized:x?.normalized??null})}

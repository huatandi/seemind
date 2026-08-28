import {createProblemState,updateProblemState,compactProblemState,deriveBrainWorkingView} from '../resolution/problem-state.js';
import {assessAnswerability} from '../answerability/answerability-engine.js';
import {buildOrchestrationContext} from '../orchestration/orchestration-context.js';
import {orchestrate} from '../orchestration/unified-orchestrator.js';

/**
 * One entry point for the decision part of SeeMind's runtime brain.
 * Specialists produce evidence; this function updates working problem state,
 * assesses whether local evidence is enough, then gives the Unified
 * Orchestrator the only final routing vote.
 */
export function runBrainMainline({task={},observation={},explanation={},capabilities={},previousProblemState=null,taskPackage=null}={}){
  const problem=explanation.problem??observation.problem??{};
  const risk=explanation.safety?.risk??explanation.safety??null;
  // ProblemSolvingSession is the canonical lifecycle state. Brain state is a derived,
  // disposable working view. `previousProblemState` remains only as a compatibility
  // fallback for callers that have not supplied a canonical session yet.
  const canonicalSession=explanation.problemState??null;
  const problemState=canonicalSession
    ? deriveBrainWorkingView({problemSession:canonicalSession,problem,risk})
    : updateProblemState(previousProblemState??createProblemState(),{problem,risk});
  const answerability=assessAnswerability({
    observation,
    problem,
    problemState,
    retrievalPlan:explanation.retrievalPlan??{},
    safety:explanation.safety??{},
    capabilities,
  });
  const packageForThisTask=taskPackage?.task?.id&&taskPackage.task.id===task.id?taskPackage:null;
  const context=buildOrchestrationContext({
    task,observation,explanation,capabilities,taskPackage:packageForThisTask,
    problemState:compactProblemState(problemState),answerability,
  });
  const decision=orchestrate({context});
  const nextProblemState=updateProblemState(problemState,{route:decision});
  return {schemaVersion:1,problemState:nextProblemState,answerability,context,decision};
}

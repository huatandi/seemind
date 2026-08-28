# SeeMind Unified Orchestration Architecture

## Principle
Consolidate authority, not process. Specialist modules keep their detailed steps. The Unified Orchestrator is the only component allowed to select the next runtime route.

## Detailed pipeline
PERCEIVE -> IDENTIFY -> UNDERSTAND -> EVIDENCE -> FRESHNESS/PRIVACY -> RESOLUTION ASSESSMENT -> CLARIFY -> RETRIEVAL -> VERIFY -> PLAN -> ROUTE -> COMPILE -> EXECUTE -> VERIFY AGAIN -> SAFETY -> EXPLAIN -> ACT/REFER -> LEARN

Not every task executes every stage. Skipped stages must be skipped by an explicit route decision, not by deleting the stage from the architecture.

## Authority boundaries
- Perception: observations only.
- World/Intent/Problem: interpretations only.
- Evidence: facts, gaps, conflicts, provenance assessments.
- Resolution: local feasibility and missing-evidence recommendation.
- Retrieval: search need, source strategy and retrieval evaluation.
- Planner: bounded task graph.
- Teacher Router: ranks external specialists after orchestration authorizes Teacher use.
- Safety: non-negotiable constraints and escalation requirements.
- Unified Orchestrator: next-route authority.
- UI: presentation only; must not invent routing policy.

## Re-entry
SEARCH, PLAN and TEACHER are non-terminal routes. Their results must return to the Orchestrator:
ORCHESTRATE -> EXECUTE CAPABILITY -> VERIFY -> RE-ENTER -> NEXT ROUTE.
This prevents search results or Teacher output from bypassing evidence and safety checks.

## Route Contract
Every decision records route, reason, phase, relevant input snapshot, rejected alternatives, next stage, and whether re-entry is mandatory.


## Execution authority
After a RouteContract is issued, UI and feature modules must not directly execute SEARCH / PLAN / TEACHER. They call ExecutionDispatcher. The Dispatcher invokes the specialist executor and emits a ResultEnvelope. Non-terminal results re-enter Unified Orchestrator after verification.

`Orchestrator -> RouteContract -> ExecutionDispatcher -> Specialist Process -> ResultEnvelope -> Verify -> Re-entry`

## Verification authority (v0.59.3)
Execution completion is not acceptance. Every non-terminal SEARCH / PLAN / TEACHER result must pass Verification Core before re-entry.

Verification Core does not replace evidence specialists. It aggregates:
1. execution status,
2. evidence source quality,
3. claim support,
4. freshness requirements,
5. independent-source consensus,
6. unresolved conflicts,
7. provenance,
8. Safety constraints.

Possible verdicts:
`ACCEPT`, `ACCEPT_WITH_CAVEAT`, `NEED_MORE_EVIDENCE`, `CONFLICT`, `REJECT`, `SAFETY_BLOCK`, `NOT_REQUIRED`.

Only the Verification Core may mark a non-terminal executor result as accepted for re-entry. Teacher output without structured claims remains a candidate and is accepted only with an explicit caveat.

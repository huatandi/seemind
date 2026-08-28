# SeeMind v0.59.4 — End-to-End Mainline Consolidation Audit

## Goal
Verify that the real Web user path follows the single orchestration mainline rather than merely containing the new architecture as unused files.

## Audited user path
Image + Voice/Text
-> Perception
-> Universal Understanding
-> Unified Orchestrator
-> Route Contract
-> Execution Dispatcher
-> Specialist Executor
-> Result Envelope
-> Verification Core
-> Re-entry
-> Unified Orchestrator
-> Presentation

## Findings corrected
1. **Teacher result presentation bypass**
   - Previous Web executor could write Teacher/Planner output directly into the conversation.
   - Fixed: capability executors now return results only. Final presentation happens only after Verification + Re-entry.

2. **Manual re-entry bypass**
   - Previous `dispatchAutomaticRoute()` manually called `reentryContext()` after execution.
   - Fixed: Web mainline now uses `runOrchestrationLoop()` with mandatory `verifyExecutionResult`.

3. **Hand-crafted Teacher contract in UI**
   - Previous UI manually created an object claiming `authority:'unified_orchestrator'`.
   - Fixed: explicit user Teacher requests are authorized through `authorizeUserRouteRequest()`.

4. **SEARCH secretly able to call Teacher**
   - `prepareGroundedTask()` can use Teacher for identity resolution.
   - Fixed in SEARCH executor: provider list is empty; missing identity is returned upward for a new Orchestrator decision.

5. **RetrievalPlan / TaskPackage search disconnect**
   - Unified Retrieval could decide SEARCH even when legacy `taskPackage.search.required === false`.
   - This produced a SEARCH route that did not actually search.
   - Fixed: SEARCH executor now executes Orchestrator-approved RetrievalPlan queries directly when no legacy grounded-search plan exists.

6. **Accepted Teacher/Planner re-entry loop**
   - A verified Teacher answer could re-enter and be routed back to Teacher because the old resolution advisory still requested escalation.
   - Fixed: accepted Teacher/Planner verdicts are recognized by Unified Orchestrator and only then routed to LOCAL presentation (or CLARIFY when Planner explicitly asks the user).

7. **UI advisory routing**
   - Initial UI labels could still use `resolution.decision` instead of the final Unified route.
   - Fixed: route labels/Teacher visibility now use `routePresentation(decision)`.

8. **Dead mainline imports**
   - Removed obsolete direct imports for old problem/resolution calls no longer used by Web mainline.

## Mainline invariants guarded by tests
- `apps/web/src/main.js` must not directly call `askTeacher`, `prepareGroundedTask`, `executePlannerExecution`, or `reentryContext`.
- UI must not hand-craft `authority:'unified_orchestrator'`.
- Web mainline must use `runOrchestrationLoop` and `verifyExecutionResult`.
- RetrievalPlan-driven SEARCH must cause a real provider call.
- SEARCH must not call Teacher to solve missing identity.
- Verified Teacher result becomes presentable only after Orchestrator re-entry.

## Deliberately retained detailed processes
- Identity verification workflow.
- Search evidence conversion, source quality, consensus, retrieval escalation.
- Planner Task Graph, node handlers, checkpoints, retry and budget.
- Teacher ranking, consent, sanitizer, budget, result validator and fallback.
- Verification Claim Judge, freshness, source quality, conflict detection and Safety.
- Persistent recovery and audit logs.

## Remaining known gaps
- Search Provider is still not configured in the default Gateway (`search.available=false`).
- Search privacy/query-redaction needs a dedicated external-retrieval privacy gate.
- Planner node-level external calls remain delegated under an approved PLAN contract rather than individually re-authorized by the top-level Dispatcher.
- Final external result attribution UI can be made richer (provider/source/caveat badges).
- Voice still relies mainly on WebSpeech in the current Web runtime.

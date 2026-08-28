# SeeMind v0.62.5 — End-to-End Mainline Audit

## Purpose
This release audits and hardens the existing mainline instead of adding new models or parallel brains.

## Fixed: stale Answerability loop
Answerability is advisory for the current evidence snapshot. After SEARCH/TEACHER/PLAN executes and Verification re-enters the Orchestrator, the old Answerability recommendation is stale.

Before this fix, an initial `SEARCH` or `TEACHER` recommendation could re-trigger after successful verification and repeat external work until `maxTransitions`.

Now Answerability only participates before an external verified re-entry. Accepted external work proceeds to the Orchestrator's post-verification logic.

## Fixed: local runtime error != teacher required
A local image-processing exception no longer changes the UI route to `TEACHER`. Runtime failure now asks the user to retry/re-capture. Teacher routing must come from Answerability + Unified Orchestrator, not from a catch block.

## Fixed: first useful latency measurement
`firstUsefulAt` now records Fast Triage completion. It no longer waits for OCR/preprocessing to finish before declaring the first useful response. This makes low-power-device tuning evidence accurate.

## Added: external-call hard budget
The runtime orchestration loop can now enforce:
- max total SEARCH/TEACHER/PLAN calls
- max repeats of the same external route

Web runtime currently uses:
- 3 external calls maximum per flow
- 2 calls maximum to the same external route

The budget stops execution before another external request is sent.

## Added: E2E health audit
Each approved external flow now emits a compact health audit checking:
- duplicate external route/reason
- max transition exhaustion
- external route budget exhaustion
- unverified external result presence
- local latency budget violation
- late first useful feedback
- repeated identical problem routes

The audit is also written to the existing durable audit log.

## Architectural boundary
No new ASR, VLM, Teacher, Search provider, Agent, or Router is introduced here. Unified Orchestrator remains the only final routing authority.

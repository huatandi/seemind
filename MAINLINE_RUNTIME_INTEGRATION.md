# SeeMind v0.62.4 — Mainline Runtime Integration

This release does not add a new AI model, provider, agent, or router.

## Why this release exists
v0.62.3 introduced compact Problem State and Answerability, but a runtime audit found an important integration gap: the web path could still call the Unified Orchestrator without first passing the new compact Problem State and Answerability assessment. The modules existed, but the live mainline did not consistently depend on them.

v0.62.4 fixes that architectural gap.

## One decision path
Perception -> Understanding -> Problem State -> Answerability -> Unified Orchestrator -> Execute -> Verify -> Present

`core/brain/brain-mainline.js` is now the single decision-stage entry point. It does not replace the Unified Orchestrator. It prepares evidence/state and invokes the Orchestrator, which remains the only final route authority.

## Teacher/Search package continuity
Compiled task packages now carry compact `problemState` and `answerability`. External capability can therefore receive what SeeMind already knows, what was tried, and why escalation is needed instead of restarting the problem from zero.

## Weak-phone fast path
A runtime latency policy now distinguishes first-useful feedback from heavy local work. On constrained devices, expensive local visual stages can be deferred when their predicted/elapsed cost would violate the fast-path budget. Deferral is explicit evidence (`HEAVY_LOCAL_VISION_DEFERRED`), not a fake success.

## Important correction
Answerability remains advisory, but its CLARIFY / SEARCH / TEACHER assessments are now explicitly arbitrated by the Unified Orchestrator. Before this correction, a CLARIFY assessment without a prebuilt evidence request could fall through to a bounded LOCAL fallback.

## Development discipline
- no new model in this release
- no second router
- no cloud upload on local failure
- no invented benchmark score
- no heavy local vision merely because a provider exists
- every external result still re-enters verification/orchestration

# SeeMind v0.70.0 — Architecture Freeze

This release freezes the core architecture for real-world testing. Further structural refactoring requires measured evidence from real images, real speech, real devices, or verified Teacher outcomes.

## Canonical production line

**Perceive → Understand → Resolve locally when possible → Detect Intelligence Gap → Borrow best Teacher/Search capability → Verify → Resolve**

## Single authorities

- **Perception Boundary** — sensor/model output becomes observation, never self-verified fact.
- **Problem Understanding / Universal Intent Router** — interprets the user's goal; downstream layers should not create parallel intent engines.
- **ProblemSolvingSession** — canonical long-lived problem state. Brain views are derived working views.
- **Unified Orchestrator** — only final route authority (LOCAL / CLARIFY / SEARCH / PLAN / TEACHER / HUMAN / STOP).
- **Intelligence Gap Router** — only production facade for deciding what external intelligence is missing.
- **Teacher Router** — only provider eligibility/ranking authority.
- **Verification Core** — only final acceptance authority for external/search/tool execution results.
- **Evidence Graph / Evidence Semantics / Claim Judge** — evidence lifecycle and support; they inform Verification Core rather than replace it.

## Preserved intelligence

Do not remove merely because a module is not on the hot path:

- targeted perception recovery and cross-modal verification;
- capability planning and bounded multi-specialist composition;
- verified Teacher outcome learning and failover;
- task-aware evidence authority;
- offline-capability modeling;
- benchmark/evaluation/promotion gates;
- grounded price comparison;
- retrieval coordination;
- safety, privacy and provenance controls.

These must be classified as Runtime, Lab/Evaluation, or Staged—not mechanically deleted.

## Removed/forbidden duplicate brains

These files must not return:

- `core/orchestration/specialist-selector.js`
- `core/decision/decision-engine.js`
- `core/teacher/teacher-performance.js`

They were replaced by stronger canonical paths.

## Runtime slimming rule

Benchmark and experimental Lab UI must not dominate the normal startup path. Pilot Lab is isolated behind `apps/web/src/runtime/pilot-lab-runtime.js` and loaded only when requested.

## Freeze rule

From v0.70.0 onward, architecture is considered stable enough for field testing. A new core abstraction is justified only if real test evidence shows that the existing boundaries cannot solve the problem cleanly.

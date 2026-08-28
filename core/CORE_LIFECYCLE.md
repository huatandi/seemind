# Core lifecycle policy — v0.68.9

Core reduction is not line-count optimization. A module may be retained without a production caller when it is a benchmark, promotion gate, corpus tool, or explicitly staged capability.

## RUNTIME
Canonical production authorities:
- perception/perception-boundary.js
- resolution/problem-understanding.js
- orchestration/intelligence-gap-router.js
- teacher/teacher-router.js
- orchestration/specialist-capability-plan.js
- orchestration/specialist-outcome-learning.js (internal learned-outcome policy, exposed through Intelligence Gap Router)
- evidence/* verification graph and provenance authorities
- evidence/task-aware-authority.js (internal claim-specific evidence weighting under Verification Core)

## LAB / EVALUATION — retain, do not wire into user runtime
- evaluation/**
- perception/perception-benchmark-arena.js
- perception/candidate-engine-catalog.js
- perception/perception-engine-health.js when used by benchmark/promotion harnesses

## STAGED / PROMOTION CANDIDATES — preserve good logic, require an explicit runtime promotion decision
- models/offline-capability-state.js
- retrieval/knowledge-retrieval-coordinator.js
- perception/perception-executor.js
- search/grounded-price-comparison.js

## DEPRECATED / REMOVE
- orchestration/specialist-selector.js — removed. It duplicated the canonical Teacher Router authority.
- teacher/teacher-performance.js — removed. Boolean success learning was superseded by verified outcome learning.
- decision/decision-engine.js — removed. Runtime routing belongs only to Unified Orchestrator.

Rule: zero production imports is a review signal, not a deletion instruction.

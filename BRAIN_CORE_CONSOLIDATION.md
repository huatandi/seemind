# SeeMind v0.62.3 — Brain Core Consolidation

This release deliberately adds no new ASR, VLM, teacher, search provider, or parallel router.

## Core chain
Perception -> Understanding -> Problem State -> Answerability -> Unified Orchestrator -> Execute -> Verify -> Present

## Problem State
A compact runtime state now tracks the active target, goal, symptoms, known facts, unknowns, attempted actions, results, constraints, risk, hypotheses, next action and recent route history. It is intentionally smaller than a general memory framework.

## Answerability
A new advisory engine estimates local confidence and evidence completeness and marks freshness/specialist/risk requirements. It can recommend LOCAL, CLARIFY, SEARCH, TEACHER, HUMAN or STOP, but it cannot execute a route. Unified Orchestrator remains the only final routing authority.

## Weak-phone visual escape hatch
A minimum-necessary visual teacher package can carry one ROI/context image only after the configured image-consent gate. If local evidence is enough, or clarification is cheaper, the package is not sent.

## Design discipline
- no provider binding in the brain
- no automatic cloud upload after local failure
- no invented certainty
- no duplicate router
- no repeated troubleshooting action when Problem State records it
- external work returns to Unified Orchestrator and verification

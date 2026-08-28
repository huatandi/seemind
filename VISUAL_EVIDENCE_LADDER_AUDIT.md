# SeeMind v0.63.8 — Visual Evidence Ladder & Capability Reality

## Finding
The runtime had no explicit semantic-specificity level for visual identity. A detector could return `car` with 0.99 confidence, while downstream code had no machine-readable way to distinguish that strong category evidence from brand/model identity.

Confidence answers **how sure**. It does not answer **how specific**.

## Fix
A small evidence ladder now classifies visual identity evidence as:
none → scene → category → family → brand → model_candidate → exact_model → state_anomaly.

`object_identity` remains the existing capability for basic object identification, preserving current region/grounding behavior. A new `specific_identity` capability is requested only when the user explicitly asks for brand/model identity.

DETR continues to provide `object_identity`, but its emitted claims are explicitly `category` evidence. It does not advertise `specific_identity`.

Brand/model questions therefore remain unresolved unless brand-level or stronger evidence actually exists.

## Runtime reality
The main observation now records the strongest identity evidence level and whether specific identity is genuinely resolved.

## Boundary
No model was upgraded in this release. This is an honesty/capability-boundary improvement, not a claim that arbitrary brand/model recognition is now available.

## Non-goals
No new Brain, Orchestrator, Learning layer, Provider, or model was added.

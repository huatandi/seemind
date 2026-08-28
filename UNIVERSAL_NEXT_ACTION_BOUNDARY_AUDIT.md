# SeeMind v0.64.3 — Universal Next-Action Boundary

## Audit finding
The world/evidence layers were already domain-aware, but `universal-explainer` still unconditionally called `planGuidedTroubleshooting`. That created a structural risk: the universal product could classify a plant, document, food, or product correctly and still pass its next-step generation through a repair-oriented planner.

## Fix
A small `planUniversalNextActions` boundary now dispatches repair-specific guidance only for an explicit `repair` world domain. All other domains use their existing domain-specific evidence request and generic resolution/help contracts.

## Architecture rule
Specialist scenarios may plug into the universal pipeline, but no specialist planner may become the default universal planner.

## Compatibility
`nextActionPlan` is the new semantic field. `troubleshooting` remains temporarily as an alias to avoid breaking older UI/tests; it can be deprecated later after consumers migrate.

## Strategic result
This is not a new feature. It removes a product-direction bias from the core and restores SeeMind's intended role as a general real-world multimodal problem-solving system.

# SeeMind v0.64.4 — Capability Composition

## Problem
A real-world request can legitimately span several domains and intents. Selecting one primary world domain is useful for ranking, but it must not erase other supported interpretations.

## Design
`universal-world-router` still ranks domains and keeps a primary domain for compatibility, but now also exposes evidence-supported active domains. A small `capability-composition` module combines those domains with the already-compound Intent Graph.

This is deliberately not another router, Brain, planner, or orchestrator. It is a declarative requirements view for downstream planning.

## Example
“这个食品是什么？翻译配料，哪里可以买？” may require food understanding + language/translation + identification + search/current-information retrieval. No single label needs to own the whole request.

## Boundary
Only domains already supported by the world classifier and intents already supported by the intent router are composed. The module does not invent evidence, execute tools, or decide truth.

## Compatibility
`worldDomain.primary` remains available. Existing consumers are not forced to migrate immediately.

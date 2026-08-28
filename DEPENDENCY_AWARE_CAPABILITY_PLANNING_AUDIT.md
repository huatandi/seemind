# SeeMind v0.64.5 — Dependency-Aware Capability Planning

## Finding
v0.64.4 could describe a problem as a composition of capabilities, but the runtime planner was still primarily selected by domain/keyword templates. A compound capability set could therefore remain an unordered declaration instead of an executable dependency graph.

## Boundary
No new Planner, Brain, Router, or Orchestrator was added. The existing Task Graph is now able to represent a bounded generic capability composition when more than two required capabilities are explicitly present and no established specialist plan applies.

## Dependency rules
- visible OCR/read does not require exact identity;
- translation depends on extracted text when OCR/read is requested;
- identity-dependent retrieval waits for identity when product/document understanding requires it;
- comparison waits for the relevant identity/search/translation branches;
- final synthesis waits on graph leaves, not every intermediate node.

## Safety and efficiency
The graph remains acyclic and budgeted. Existing retries, checkpoints, idempotency receipts, user-confirmation blocking, evidence validation, and Teacher boundaries remain unchanged.

## Non-goals
This release does not implement a shopping engine, repair engine, or a new agent loop. It improves the universal execution substrate so future domain capabilities can compose without owning the core architecture.

# SeeMind v0.62.2 — Cross-Turn Object Continuity

## Goal
Keep the real-world object stable across natural follow-up language without turning conversation history into invented visual evidence.

Example:
1. User shows a control panel: "这个红灯是什么？"
2. User follows up: "那它为什么一直响？"
3. Later: "哪里可以买到？"

SeeMind should know that "它" can refer to the previously grounded object, while still allowing a new current visual reference to override stale context.

## Entity continuity state
A multimodal session now maintains a bounded entity set:
- entity id
- visual region id when available
- semantic label
- confidence
- recency
- current focus entity

The state is evidence derived from visual grounding/identity, not free-form memory.

## Resolution precedence
1. Explicit/current visual grounding wins.
2. A continuity signal such as 它 / 这个 / 刚才那个 / it / this one / éste may resolve to the focused prior entity.
3. If there is no prior grounded entity, the reference remains unresolved.
4. Conversation continuity never creates a new visual fact.

## Benchmark
A sequential multimodal runner now keeps one real session across cases and reports continuity success for cases with human-confirmed `conversationEntity` or `continuityReference`.

This prevents a misleading benchmark where every follow-up is tested as an isolated sentence.

## Boundary
This is short-session working context, not long-term personal memory. It tracks the object/problem being discussed so the Unified Orchestrator can later route the next request correctly.

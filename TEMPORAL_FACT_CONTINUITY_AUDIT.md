# SeeMind v0.64.9 — Temporal Fact Continuity

## Audit conclusion
The existing Object Continuity module answers “which real-world entity is the user referring to?”. Evidence Semantics answers “what kind of evidence is this and is it still valid?”. Conversation Session stores turns and observations. The missing link was a temporal fact view: “for this same entity, which claim is current and which claims are history?”.

## Design
The Evidence Graph remains the source of truth. `buildCurrentEntityFacts()` derives:
- current facts from usable evidence only;
- full auditable history;
- unresolved concurrent conflicts.

No new Memory Brain or parallel fact database was added.

## Anti-resurrection invariant
A superseded, retracted, expired, or conflicted claim may remain in history but cannot become a current fact simply because a later conversation turn references the same entity.

## Reconciliation invariant
A newer contradictory fact does not erase the older one. The older claim becomes superseded and remains auditable; the new claim becomes current only through evidence semantics.

## Conversation boundary
Conversation Session may cache a derived fact snapshot for continuity. It is not authoritative storage; Evidence Graph remains authoritative.

## Domain neutrality
The same mechanism applies to product prices, receipt fields, object states, document facts, user-reported history, places, food, travel information, and future capabilities.

# SeeMind v0.65.0 — Evidence → Final Answer Contract Audit

## Finding
SeeMind already had an Explanation & Action Contract that separated observed facts, user reports, inferences, actions and unknowns. It also had Answer Contract claims and Verification. After v0.64.8–0.64.9, however, the final-answer boundary did not yet consume the richer evidence lifecycle/temporal semantics. That created a risk that a sophisticated internal evidence model could collapse back into ordinary undifferentiated prose.

## Fix
A thin `evidence-answer-contract` projects verified evidence into seven user-facing epistemic buckets:
1. current confirmed facts
2. user reports
3. inferences
4. historical facts
5. conflicts
6. unknowns
7. provenance

It does not replace the existing Explainer or Answer Contract.

## Invariants
- inactive evidence never becomes live provenance;
- historical facts remain history;
- user reports are not promoted to observations;
- unresolved verification conflicts remain visible;
- unsupported/freshness gaps remain unknown rather than being polished away;
- Teacher is not an authority that can override evidence lifecycle.

## Strategic result
The internal evidence architecture now has a defined path to user-facing truthfulness without creating a domain-specific UI or a second answer engine.

# SeeMind v0.64.8 — Evidence Semantics / Fact Lifecycle Audit

## Finding
SeeMind already had evidence graphs, provenance, source quality, freshness, consensus, and claim judging. The missing layer was not another evidence engine; it was a common epistemic/lifecycle contract. A photo observation, OCR extraction, user report, external source, teacher result, and inference could otherwise arrive downstream with similar-looking confidence fields while having different meanings.

## Boundary added
Every evidence item may now carry a `semantics` envelope:
- evidenceKind
- lifecycleState
- confidence
- observedAt
- assertedAt
- validUntil
- provenanceRef
- supersedes
- derivedFrom

This is additive and backward-compatible.

## Lifecycle rule
New evidence does not erase old evidence. When one item replaces another, the old item becomes `superseded` and the replacement links back to it. This preserves auditability and prevents yesterday's state from silently becoming today's state.

## Verification rule
Inactive evidence (superseded, retracted, expired, conflicted) cannot satisfy a supported factual/price/safety claim merely because its ID is present.

## Strategic purpose
This keeps SeeMind domain-neutral. The same semantics apply to a receipt total, product price, plant observation, translated document, travel fact, user-reported history, or any future specialist capability.

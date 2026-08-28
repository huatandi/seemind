# SeeMind v0.64.0 — Voice Runtime Reality & Recognition Guardrails

## Scope
Audit the existing Voice path before adding new engines or a second voice architecture.

## Existing strengths confirmed
- Voice engine registry and adaptive routing already exist.
- First-partial and final latency are measured.
- Engine fallback and total/per-engine budgets already exist.
- ASR alternatives are already context-rescored using visual/OCR/conversation evidence.
- Low-confidence and close alternatives already request confirmation.

## Real defects fixed

### Regional language tags
Routing previously required exact string membership. An engine declaring `zh` could be penalized for a normal browser locale such as `zh-CN`; likewise `es` vs `es-MX`. BCP-47 base-language matching now preserves the intended language fit. Explicit `multilingual` engines also receive full language fit.

### Context-dominated silent correction
The rescorer detected `CONTEXT_DOMINATES_ACOUSTIC` but did not include that condition in `shouldClarify`. The system could therefore notice that context was doing too much work and still silently submit the result. It now asks the user to confirm.

### Lost partial latency on failure
An engine can produce a fast partial transcript and then time out/fail. That partial latency was discarded on the failure path, hiding useful runtime evidence. It is now retained in attempt/performance/outcome records.

## Strategic boundary
No new ASR engine was promoted. No claim is made that recognition accuracy improved by a percentage. This release improves routing correctness, observability, and correction safety around the existing engines.

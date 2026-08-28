# SeeMind v0.62.9 — Vision + Voice Mainline Audit

## Scope
This release audits the two most important local entrances to SeeMind: image understanding and speech understanding. It does not add a new model, provider, teacher, agent, or router.

## Vision finding: universal images could still pay OCR tax
Fast Triage correctly distinguishes document vs universal vision, but `needsOcr` could still become true for a natural image containing visible text. `local-student` then ran full image preprocessing + OCR ensemble before universal visual capabilities.

That creates the wrong product priority for SeeMind: a refrigerator, machine, plant, storefront, control panel, animal, or other real-world image should not wait behind receipt/document OCR merely because text exists in the frame.

### Fix
Triage now exposes `ocrMode`:
- `primary`: document route; OCR is on the critical path.
- `support`: natural/hybrid image contains useful text; OCR is supporting evidence and is deferred from the first universal-vision path.
- `deferred`: no OCR need on the first path.

Universal-vision budgets now reserve zero OCR candidates/engines on the critical path.

## Voice finding: context could over-correct ASR
Speech alternatives were scored 58% acoustic / 42% context. A word already present in OCR/conversation could therefore overpower a materially stronger acoustic hypothesis.

This is dangerous because one ASR mistake can become a wrong user intent and contaminate Problem State.

### Fix
- acoustic evidence now carries 72% weight
- context carries 28%
- close alternatives are explicitly marked uncertain
- low-acoustic-confidence hypotheses are explicitly marked uncertain
- uncertain speech is placed into the text box for user confirmation/editing instead of automatically entering Brain Mainline

Context remains useful for brands, models, objects, OCR words and conversation continuity, but it is no longer allowed to manufacture certainty.

## Product rule
Fast local perception should produce useful evidence quickly. Heavy OCR/vision and external teachers are follow-up capabilities, not mandatory toll gates.

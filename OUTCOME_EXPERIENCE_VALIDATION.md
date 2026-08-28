# SeeMind v0.63.3 — Outcome Feedback & Experience Validation

## Goal
Close the loop between scenario-aware routing and real runtime outcomes without teaching the system the wrong lesson.

## Strict attribution
Perception engines are only updated from outcomes that can reasonably be attributed to them.

### Attributable
- engine completed / failed / timed out -> technical execution reliability
- uncertain ASR transcript explicitly confirmed by the user -> recognition-quality confirmation
- uncertain ASR transcript edited before submission -> recognition-quality correction

### Not attributable
- the device/problem was not fixed
- Search failed
- Teacher failed
- a human handoff happened
- the user still needs help

Those are downstream outcomes and must never be counted as Vision/Voice recognition failures.

## Outcome store
Runtime experience is stored by:
- device
- modality
- engine
- scenario

The store keeps technical attempts/failures separately from quality confirmations/corrections.

## Experience validation
Routing is adjusted only after enough attributable evidence exists.

Default guards:
- at least 8 technical attempts before technical reliability can change ranking
- at least 5 explicit quality confirmations/corrections before semantic-quality feedback can change ranking
- evidence older than 30 days is ignored

Adjustments are bounded:
- repeated technical failures can reduce ranking
- repeated transcript corrections can reduce ranking
- stable explicit confirmations can add only a small positive bonus

## Voice confirmation loop
When ASR alternatives are too close or acoustic confidence is low, SeeMind already asks the user to confirm/edit the transcript. v0.63.3 now treats that explicit action as qualified learning evidence:
- unchanged submission -> confirmed
- edited submission -> corrected

High-confidence auto-committed speech does not create a fake confirmation signal.

## Vision boundary
Vision currently contributes only attributable technical runtime outcomes automatically. It does not infer semantic failure merely because the user re-shoots the photo or the real-world problem remains unresolved.

## Principle
Experience can validate or weaken a learned scenario preference. It cannot bypass capability, health, privacy, language, installation, or device-resource gates.

# SeeMind v0.63.6 — Vision Prepared Asset & First Useful Audit

## Scope
This release continues the Vision critical-path audit from the real v0.63.5 baseline. It does not add a model, Provider, Router, Brain, or Learning layer.

## Finding: the same image was decoded twice at upload time
The web entry path executed these branches in parallel:

- `observeImage(file)` -> Fast Triage -> `createImageBitmap(file)` -> 640px canvas/pixel inspection
- `prepareVisionAttachment(file)` -> `createImageBitmap(file)` -> 1600px canvas/JPEG/DataURL

Parallel execution hid some wall-clock latency but could increase CPU and memory pressure on mobile because two full image decodes and two canvas pipelines existed at the same time.

## Fix: shared prepared source
A new lightweight `prepared-image-source` owns one decoded drawable. The web upload path decodes once and lends the same source to:

- Fast Triage (640px derived view)
- Vision attachment preparation (up to 1600px derived view)

Each consumer only draws from the shared source. The shared source is closed as soon as both consumers have consumed it; it is not kept alive through Heavy Vision, OCR, Search, or Teacher work.

Fallback behavior remains intact: if shared preparation is unavailable, the existing independent decode paths still work.

## First useful boundary
`observeImage()` now exposes the completion of Fast Triage via `onFirstUseful`. The web UI can acknowledge that the image has been seen and that the system is reading key text or confirming the visual object before the entire perception pipeline completes.

This feedback is deliberately non-hallucinatory. It does not invent object identity, model, receipt fields, diagnosis, or expert conclusions.

## Not changed
- Universal Vision / OCR routing policy
- Heavy Vision Provider interface
- Teacher image package format (`dataUrl` remains required by the current gateway prompt path)
- Evidence / Problem / Answerability / Orchestrator / Verification
- Provider capability and health gates

## Remaining image work
Some visual Providers can still decode the original `File` independently because their input contracts differ. That is a separate optimization and should only be changed after provider-specific compatibility and memory measurements prove it safe.

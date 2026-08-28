# SeeMind v0.65.2 — Mobile Reality Audit

## Strategic conclusion
The next bottleneck is perception reality, not reasoning architecture. SeeMind already has device profiling, fast visual triage, OCR routing, visual model delivery/cache, voice routing, Teacher routing, privacy consent, latency budgets, and benchmark infrastructure. The correct move is to harden these existing paths rather than create another perception brain.

## Real gaps found
1. Mobile Safari often does not expose `navigator.deviceMemory`. The previous profile treated missing RAM too neutrally and allowed a 384 MB visual budget. On a phone, missing RAM is uncertainty, not proof of capacity.
2. A user could type a question before selecting a photo, but the capture path did not pass that question to `observeImage()`. Fast triage therefore lost strong intent evidence such as “translate/read this receipt” and could spend the first pass on the wrong branch.

## Fixes
- Memory-unknown mobile devices receive a conservative 256 MB visual ceiling and 4.5 s inference ceiling.
- Perception budget carries the device uncertainty explicitly.
- Pre-capture user intent now reaches triage, explanation, and task construction on the first image pass.

## Existing strengths to keep
- First-useful visual triage before heavy work.
- OCR only when text/document evidence justifies it.
- Model Manager requires explicit model preparation and supports offline reuse.
- Heavy local vision is latency-gated.
- External Teacher calls require consent and use the existing orchestration/verification path.
- Real-device/Pilot benchmark infrastructure already exists.

## Next hardening order
1. Real-device vision benchmark matrix: low / balanced / high-end phones.
2. OCR difficult-image corpus: blur, low contrast, thermal paper, bold currency symbols, rotated receipts.
3. Exact product identity: barcode + OCR + visual identity fusion.
4. Voice: multilingual continuous-turn latency and fallback behavior.
5. Offline model cold-start/download/cache recovery.
6. Teacher escalation latency, minimum-image packaging, and verified re-entry.

Do not add a new Core abstraction unless one of these measured user journeys proves the existing architecture cannot carry it.

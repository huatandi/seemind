# SeeMind VISION LAB + VOICE LAB

## Goal
Perception engines compete on real target-device tasks before becoming defaults. Brand reputation, benchmark marketing, and one successful demo are not promotion criteria.

## VISION LAB
World-first category weights:
- Everyday objects: 12%
- Products/models: 12%
- Plants/animals: 12%
- Devices/components: 12%
- Scenes/places: 10%
- Anomaly inspection: 10%
- Food/materials: 8%
- Vehicles/transport: 8%
- Signs/symbols: 8%
- Documents/receipts: 8%

Documents/receipts may not exceed 15% of benchmark cases. This prevents receipt performance from defining SeeMind's universal-vision quality.

Metrics:
- success rate
- semantic label/answer quality
- p50 latency
- p95 latency
- device compatibility
- memory where measurable
- failure/circuit-breaker behavior

## VOICE LAB
Coverage:
- plain intent
- visual references
- brand/model terms
- problem descriptions
- mixed language
- noisy/uncertain speech

Metrics:
- WER
- intent accuracy
- partial latency
- final latency
- fallback success
- context-rescoring benefit

## MULTIMODAL LAB
High-weight checks:
- user intent
- speech reference
- image target grounding
- state/problem extraction

The target/reference relationship receives more weight than generic text similarity because SeeMind must understand what in the image the user is talking about.

## Promotion
An engine needs:
1. enough benchmark cases,
2. release-gate success,
3. no material regression versus baseline,
4. a clear advantage before canary selection.

Near-ties remain unresolved rather than forcing a winner.

## Experimental adapters
The codebase now includes non-default experimental adapters for:
- SmolVLM 256M through Transformers.js-style `image-text-to-text` runtime
- Moonshine through an injected runtime
- sherpa-onnx WASM through an injected runtime

These adapters do not bundle model binaries and do not make the engines available by default.

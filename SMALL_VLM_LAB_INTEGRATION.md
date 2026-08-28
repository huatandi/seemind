# SeeMind v0.61.7 — Small VLM Lab Integration

## Purpose
This release introduces the first real small-VLM candidate into the existing Vision Lab race without making it part of the production visual path.

## Candidate
- Lab ID: `smolvlm-256m`
- Model: `HuggingFaceTB/SmolVLM-256M-Instruct`
- Runtime: `@huggingface/transformers`
- Role: experimental small VLM
- Default enabled: no
- Automatic production registration: no
- Automatic promotion: no

## Operator consent
The Pilot Lab exposes an explicit checkbox. If selected, the operator sees a second confirmation before the model is allowed to load. The UI warns about approximate download and runtime-memory cost.

Low-power devices do not offer this candidate by default.

## Same-exam rule
The experimental VLM runs through the same `runEngineCompetition()` path and sees the same real Pilot cases as:
- `seemind-current-vision`
- installed object/scene visual providers

It therefore receives the same quality, success, p50 and p95 accounting and the same baseline/promotion checks.

## Benchmark prompt
The Lab prompt is world-oriented, not receipt-oriented. It asks for visible objects/products/devices/animals/plants/scenes/signs/materials/vehicles/abnormal states and explicitly tells the VLM not to invent hidden details, model numbers, damage, danger or unreadable text.

## Lifecycle
The candidate adapter is disposed after the Lab run. A successful run does not add it to the production visual provider registry.

## Voice
This release intentionally does not pretend that the Voice side is solved. Prerecorded-audio Benchmark remains disabled until a real file-capable local ASR runtime is connected.

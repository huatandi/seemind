# SeeMind Real Engine Benchmark Loop

v0.61.6 closes the first practical loop from real test media to engine comparison.

## Real assets
Pilot Lab no longer stores only filenames. Selected image/audio files are written to a local Benchmark Asset Vault backed by IndexedDB when available. Corpus cases refer to them through `vault:` references.

Deleting a collected case also removes its local benchmark asset.

## Vision competition
The operator can run the collected real Vision cases against:
1. `seemind-current-vision` — the current SeeMind local perception baseline.
2. Any currently installed visual provider that truly exposes object/scene understanding.

The same real cases and ground truth are used for every engine.

## Voice competition
The Voice Benchmark button only becomes usable when at least one registered Voice Engine can transcribe prerecorded audio (`transcribeCase` or `transcribe`).

WebSpeech is intentionally excluded from prerecorded-audio benchmarking because it is a live microphone adapter, not a file transcription engine.

## Metrics
For each engine:
- semantic visual quality / transcription quality
- success rate
- p50 latency
- p95 latency
- per-case failures

Each candidate is compared against a baseline. Results are stored per device and shown again after reload.

## Promotion boundary
A comparison result is evidence for Lab/Canary decisions only. It does not automatically replace the production engine. Release Gate, sufficient case count, no material regression and canary policy remain required.

## Current truth
The loop is operational for real local vision cases when the files and labels exist. Voice file benchmarking remains unavailable until a real file-capable local ASR adapter is installed.

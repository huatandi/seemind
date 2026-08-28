# SeeMind Real Device Benchmark

v0.61.3 moves the perception program from synthetic code tests toward reproducible real-device evidence.

## Required evidence
A model cannot become SeeMind's default because an adapter loads or a demo works. Promotion evidence should contain:
- a versioned corpus manifest,
- real image/audio asset references,
- device profile,
- per-case result rows,
- success/quality/latency metrics,
- held-out validation results.

## Corpus discipline
Use a development split for tuning and a deterministic held-out validation split for promotion decisions. Do not tune prompts, thresholds, routing or model choice against held-out results.

The starter manifest contains placeholders only. It intentionally does not invent media or ground truth.

## Recommended initial size
- Vision: 120–200 real images.
- Voice: 80–150 real clips.
- Multimodal: 40–80 image+utterance pairs.

World-first vision rules from v0.61.2 remain in force: receipts/documents are a specialist minority, not the benchmark center.

## Device evidence
Capture platform, mobile/desktop, CPU concurrency, approximate memory when exposed by the browser, WebGPU availability, WASM availability and inferred device tier.

## Sessions
Each engine/device/corpus run becomes a BenchmarkSession. Sessions preserve individual case results before aggregation, making regressions inspectable rather than hiding them behind one score.

## Reporting
Benchmark reports aggregate sessions by engine/modality and expose success rate, quality, p50 and p95 latency. They can be exported as JSON for comparison or later dashboard use.

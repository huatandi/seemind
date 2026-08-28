# SeeMind v0.62.0 — Voice League Evidence Routing

This release deliberately stops the model-collection phase after adding a capability-gated Sherpa-ONNX WASM adapter.

## Three experimental routes
- Whisper Tiny Multilingual — multilingual baseline candidate.
- Moonshine Base — English low-latency candidate.
- Sherpa-ONNX WASM — Chinese/English candidate, only available when a compatible runtime and model are actually installed.

## No fake Sherpa installation
SeeMind does not bundle, guess, or silently download a Sherpa model in this release. The UI enables the Sherpa candidate only when the host exposes a compatible runtime loader. Otherwise it stays disabled and says why.

## Evidence matrix
Voice League now builds a per-language engine matrix containing:
- case count
- quality
- success rate
- p50 latency
- p95 latency
- promotion evidence
- baseline verdict

A recommendation helper ranks evidence quality first, then success, then latency when quality is close.

## Important boundary
The recommendation is evidence-only. It does not change the production voice router. Real production routing requires enough real corpus cases, device coverage, release gates and canary evidence.

## Development direction
Do not add more ASR engines next. Build the real corpus:
- Chinese
- Mexican Spanish
- English
- mixed-language speech
- brand/model names
- numbers
- noisy shop/street environments
- near/far microphone distances

Only after real measurements should the production router learn per-language/per-device preferences.

# SeeMind Universal Perception Architecture

## Product priority
SeeMind is a universal image + voice understanding system. Receipt parsing is a specialist document capability, not the default worldview.

Priority:
1. Understand the image quickly.
2. Understand what the user says about the image quickly.
3. Fuse both into one problem representation.
4. Solve locally when confidence and time budget allow.
5. Otherwise route the unresolved subproblem to retrieval, an appropriate Teacher/tool, or a professional/human path.

## Image mainline
`Image -> Fast Triage -> Perception Budget -> Visual Capability Routing -> Specialist branches as needed`

Fast Triage is intentionally cheap. It estimates document/text likelihood versus natural-image likelihood before expensive OCR preprocessing.

- Natural image: general vision is the main road; OCR is deferred unless text evidence warrants it.
- Document/text image: OCR/document structure becomes a specialist branch.
- Hybrid/uncertain: both may be used within a bounded budget.

Receipt parsing remains supported under the document branch.

## Time budgets
Perception has a first-useful-understanding target and a bounded local total budget. Device tier changes the budget. Heavy work must not continue indefinitely merely because a local model exists.

## Engine neutrality
`PerceptionEngineRegistry` and `VoiceEngineRegistry` are model/provider neutral. FastVLM, SmolVLM, MobileCLIP, Moonshine, sherpa-onnx, whisper.cpp or future engines can be added later as adapters; none is hardcoded as SeeMind itself.

## Benchmark before promotion
Every candidate engine must be evaluated on:
- success rate
- quality/accuracy
- p50 latency
- p95 latency
- memory/device fit
- task/language fit

A smarter model that violates latency or reliability targets is not automatically promoted.

## Voice
Voice is a first-class perception channel, not merely a text-entry shortcut.

Current WebSpeech remains a runtime adapter and is not treated as a guaranteed local/offline engine. The new Voice Registry/Router can later host streaming local ASR engines. It already records partial and final latency separately and supports multiple alternatives when the adapter exposes them.

## Multimodal direction
Vision and voice should eventually guide each other:
- speech reference -> visual target/region
- visual vocabulary -> ASR contextual rescoring
- both -> unified observation/problem

This release builds the fast-path and engine-selection foundations without falsely claiming that new VLM/ASR model binaries are already integrated.

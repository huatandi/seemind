# SeeMind Perception Engine Integration

## Purpose
This layer turns visual/voice model selection into a measured runtime process without binding SeeMind to any single model family or vendor.

## Rules
1. Candidate engines enter through an adapter contract.
2. Capability + device + language + locality determine eligibility.
3. Historical quality, success rate and latency affect ranking.
4. A failing engine does not own the user experience: bounded fallback is mandatory.
5. Repeated failures open a temporary circuit breaker.
6. Promotion requires Release Gate success; a smarter-but-too-slow engine is not promoted.
7. Existing VisualProviderExecutor remains the authoritative visual execution path. The cross-modal Perception Registry does not duplicate it.
8. Candidate catalogs never imply that a model binary is installed.

## Current candidate families
- FastVLM — candidate
- SmolVLM — candidate
- MobileCLIP/embedding — candidate
- DETR — optional integrated auxiliary detector
- Moonshine — candidate
- sherpa-onnx — candidate
- whisper.cpp — candidate
- WebSpeech — integrated runtime adapter

## Voice fallback
Voice routing now produces a primary engine plus fallbacks. Runtime execution has:
- total voice budget,
- per-engine timeout,
- failure fallback,
- latency recording.

## Cross-modal ASR rescoring
ASR alternatives can be rescored using vocabulary extracted from the current visual observation and recent conversation. This allows visible brands/models/labels to correct acoustically plausible but contextually wrong transcriptions.

## Boundary
No candidate engine is marked installed merely because it appears in the catalog. Actual adapters/binaries must be integrated and benchmarked on target devices.

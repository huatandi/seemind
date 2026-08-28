# SeeMind v0.61.8 — Local Multilingual ASR Enters Voice Lab

## Decision
The first browser file-ASR candidate is `onnx-community/whisper-tiny`, loaded with the existing `@huggingface/transformers` runtime.

Why it enters before Moonshine: SeeMind is global and the first Voice corpus must cover Chinese, Spanish, English and mixed speech. Current Moonshine browser examples are attractive for speed, but the commonly available Moonshine Base candidate is English-focused. Whisper Tiny provides a multilingual baseline first. Moonshine and sherpa-onnx remain future candidates and should beat this baseline in the same Lab rather than replace it by assumption.

## Boundaries
- Lab-only; never registered as the live microphone recognizer.
- Explicit checkbox + confirmation before model download.
- Low-power devices are gated out by default.
- WebSpeech remains the live microphone path.
- The ASR candidate accepts prerecorded audio, decodes it locally with WebAudio, mixes to mono, resamples to 16 kHz, then runs local Transformers.js inference.
- The same Voice Benchmark computes transcript quality/WER, success, p50 and p95.
- The adapter is disposed after the race.

## Next evidence
Collect real zh-CN, es-MX, en and mixed zh/es/en recordings, especially product names, model numbers, visual-reference utterances and noisy shop environments. No production promotion should occur from synthetic audio alone.

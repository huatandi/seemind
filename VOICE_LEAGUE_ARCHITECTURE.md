# SeeMind v0.61.9 — Language-Aware Voice League

## Why this release exists
The Voice Lab must not declare one ASR engine globally best simply because it is fast in one language.

## Current Lab roles
- Whisper Tiny Multilingual: multilingual file-ASR baseline candidate.
- Moonshine Base: English-only low-latency candidate.
- WebSpeech: live microphone runtime adapter; not a prerecorded-file benchmark engine.

## Language cohorts
Voice cases are grouped by language family before competition:
- zh
- es
- en
- other/auto families

Only engines that explicitly support the cohort are allowed to compete in that round.

Example:
- English round: Whisper Tiny + Moonshine
- Spanish round: Whisper Tiny
- Chinese round: Whisper Tiny

Moonshine is not penalized for failing Spanish/Chinese because it is not entered in those rounds, and it is never misrepresented as multilingual.

## Same-evidence rule
Within each language cohort, eligible engines receive the same audio cases and ground truth, so WER/quality/success/p50/p95 comparisons remain meaningful.

## Production boundary
All new engines remain Lab-only. Winning a language cohort does not replace the production voice path. Promotion still requires sufficient real cases, release-gate success, no material regression and canary policy.

## Next candidates
Sherpa-ONNX can later enter as another local route, especially for Chinese/English WASM scenarios. It should join through the same language-aware eligibility rules rather than becoming a hardcoded default.

# SeeMind Real Benchmark Corpus

This folder stores manifests only. Real user/test media should be added deliberately and must not be invented by the application.

Recommended first corpus:
- Vision: 120–200 images, with documents/receipts <= 15%.
- Voice: 80–150 clips across Mandarin, Spanish, English, mixed-language, brand/model terms, visual references, and noisy speech.
- Multimodal: 40–80 image+utterance pairs where the utterance refers to a visible target.

Keep a development split for tuning and a held-out validation split for promotion decisions. Do not tune on the held-out split.

# SeeMind v0.62.1 — Real-World Multimodal Stage

## What changed
The Pilot Lab can now store what the user actually said alongside a real image and run that pair through SeeMind's existing visual observation + speech evidence + visual-language grounding + intent pipeline.

This is not a new all-purpose model. It exercises SeeMind's own coordination logic.

## Real multimodal case
A case contains:
- real image asset reference
- speech/text utterance
- language
- scenario/conditions/tags
- human-confirmed ground truth: intent, reference, target, state/problem

Example:
image: device control panel
speech: "右边这个红灯为什么一直闪？"
ground truth: diagnose | 右边 | target-region-id | blinking_indicator

## Runner
The Multimodal Benchmark:
1. resolves the real image from the local Asset Vault
2. runs the current approved visual pipeline
3. extracts speech evidence
4. grounds spatial/semantic references to visual regions
5. resolves intent
6. scores intent/reference/target/state against ground truth
7. reports success, grounding quality, p50 and p95

No benchmark score is invented before real cases run.

## Corpus audit
A new audit checks that the real-world corpus is not just a pile of easy identification examples. It asks for:
- reference cases
- state/problem cases
- follow-up context
- zh/es/en coverage
- noise conditions

## Architectural boundary
This stage strengthens SeeMind itself: seeing + hearing + context binding. It does not add another teacher, ASR or VLM. External search/teacher/human routing remains downstream under the Unified Orchestrator.

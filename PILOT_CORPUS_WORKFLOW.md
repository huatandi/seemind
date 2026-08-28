# SeeMind Pilot Corpus Workflow

## Why this exists
v0.61.4 turns the real-device benchmark foundation into an executable pilot workflow. It still does not invent media, labels, transcripts or benchmark wins.

## First pilot target
- 30 real vision cases
- 20 real voice cases
- 10 real multimodal image+utterance cases

This is intentionally small enough to collect quickly and large enough to expose obvious latency, grounding, language and fallback failures before a 300-case corpus is built.

## Collection
Every case needs an asset reference and ground truth.
Vision cases use one of the world-first categories and expected labels.
Voice cases store transcript and optional intent.
Multimodal cases store visible target and preferably intent/reference/state.

## Integrity
Assets can be fingerprinted so a renamed file is not accidentally counted as a new case.
Ground-truth auditing blocks benchmark promotion when labels, transcripts or visual targets are empty.

## Running
`runBenchmarkCases()` is engine-neutral. It:
1. resolves the real asset,
2. executes the engine,
3. times the case,
4. scores through an injected task-specific scorer,
5. records failures without aborting the entire session,
6. returns the same BenchmarkSession format used by reports and promotion policy.

## Comparison
`compareAgainstBaseline()` reports quality, reliability and latency deltas. A faster engine is not called an improvement if it materially loses quality; a higher-quality engine is not called an improvement if it becomes unacceptably slow.

## Boundary
The starter workflow is infrastructure. No real benchmark result exists until actual user/test media and reviewed ground truth are supplied and run on target devices.

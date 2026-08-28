# SeeMind Pilot Lab UI

v0.61.5 exposes the previously headless Pilot Corpus workflow in the web application.

## What the operator can do
- Open **感知实验室** from the main SeeMind screen.
- Add vision, voice, or multimodal benchmark cases.
- Select the approved world-first vision/voice category.
- Record an asset reference and human-reviewed ground truth.
- See progress toward the first Pilot target: 30 vision / 20 voice / 10 multimodal cases.
- See blocking ground-truth warnings and world-coverage warnings.
- Remove mistaken cases.
- Export/import the corpus as JSON.

## Multimodal ground truth entry
Use:
`target | intent | reference | state/problem`

Example:
`红色指示灯 | explain | 右边这个红色的 | 持续闪烁`

## Important boundary
This screen is a corpus collection/control surface. It does not claim a benchmark has run merely because cases exist. Real engine competition still requires real resolvable assets and the Benchmark Runner.

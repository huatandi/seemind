# SeeMind v0.66.3 — Cold Start & Model Warmup Reality

## Principle
First-use latency must be measured separately from warm reuse. Warmup is allowed only when it reduces likely cold-start cost without stealing the user's fast path, forcing model downloads, or retaining heavy models on constrained phones.

## Policy
- **Low-power / Save-Data:** no normal idle warmup.
- **Balanced:** tiny/light runtime initialization only.
- **Performance:** tiny/light/medium runtime initialization may be scheduled when the network is not constrained.
- **Heavy models:** on-demand only in this release.
- **Downloads:** never initiated by warmup.

## Current safe warmup
The web app may preload the Tesseract JavaScript runtime during browser idle time. It does not run recognition and does not change routing. This targets module/runtime cold-start overhead while preserving user control and mobile memory discipline.

## Benchmark contract
Record cold, warm, and hot reuse separately. Never report a hot second-run latency as representative first-use performance.

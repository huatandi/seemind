# SeeMind v0.64.1 — Multimodal Ordinal Grounding Reality

## Existing architecture confirmed
The project already had visual-language grounding, region evidence, multimodal fusion, object continuity, and Active Vision. A second multimodal router was therefore unnecessary.

## Real gap
Speech could extract left/right, red/green indicators and deictic references, but not ordinal phrases such as “第二个 / second one / el segundo”. The user could ask about the second light while the Problem State had no explicit ordinal reference to ground.

## Fix
Ordinal references 1–3 are extracted in Chinese, English, and Spanish. They may resolve only when visual object regions form a clearly dominant horizontal row or vertical column. The selected region is determined from normalized geometry, never provider/detector output order.

## Safety boundary
A grid, diagonal cluster, overlapping objects, missing bounding boxes, or otherwise ambiguous layout does not produce an ordinal guess. The reference stays unresolved so the existing visual-grounding / Active Vision path can ask for a clearer view.

## Why this matters
A phrase like “第二个为什么一直闪？” can now preserve:
- ordinal target → grounded visual region
- blinking → symptom
- 一直 → temporal persistence
- 为什么 → causal intent

without converting speech into unsupported visual facts.

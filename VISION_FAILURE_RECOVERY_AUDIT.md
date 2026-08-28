# SeeMind v0.65.4 — Vision Failure Recovery Audit

## Finding
SeeMind already had all of the important pieces: image-quality measurement, adaptive preprocessing, next-best visual evidence, evidence requests, device budgets, and Teacher escalation. The missing behavior was a bounded policy connecting image failure conditions to the cheapest useful recovery action.

## Recovery hierarchy
1. Recover pixels locally when exposure/contrast can be improved without inventing evidence.
2. Crop/select the decisive region when the target is too small or identity depends on a label/nameplate.
3. Ask for one concrete better capture when blur, glare, or missing context is the bottleneck.
4. Do not repeat local recovery indefinitely.
5. Escalate only the unresolved visual subproblem through the existing minimum-necessary Teacher path.

## Principle
A larger model cannot recover information that the camera never captured. SeeMind should first improve evidence quality, not hide poor evidence behind expensive inference.

## Domain neutrality
This applies equally to products, documents, food labels, plants, animals, vehicles, places, and general visual questions. It is not a repair-specific subsystem.

# SeeMind v0.66.2 — Shared Image Pipeline & Zero-Waste Decode

## Finding
The previous pipeline already shared one prepared decode between fast triage and the external vision attachment. The remaining measurable waste was inside OCR preprocessing: each enhancement candidate called `preprocessImage()` independently and therefore decoded/resized/read back the same original image again.

## Change
OCR now decodes/resizes/reads source pixels once and derives up to four enhancement candidates from the same immutable pixel base. When a `PreparedImageSource` is supplied by the web capture path, OCR borrows that drawable and performs zero additional source decodes.

## Memory discipline
This is not “cache every image representation.” Candidate canvases are transient, backing stores are released after blob creation, candidate count stays bounded, and ownership of a borrowed prepared source remains with the caller.

## Strategic rule
Decode once when evidence shows reuse is useful; derive only the representations required by the current perception budget. CPU savings must not be purchased with unbounded mobile memory retention.

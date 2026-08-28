# SeeMind v0.63.7 — Visual Provider Resource Ownership Audit

## Scope
Follow-up to v0.63.6 shared image preparation. This round does not retain the full prepared bitmap through Heavy Vision and does not add a second image pipeline.

## Finding
`PixelColorStateProvider.readPixels()` always called `source.close()` after drawing. That was correct only when the provider itself created an ImageBitmap from Blob/File input. If a caller supplied an existing drawable, the provider silently closed a resource it did not own.

This was not exposed by the current mainline because Heavy Vision still receives the original File, but it is a real lifecycle defect and would break safe drawable reuse across providers.

## Fix
Image resource ownership is now explicit:
- Blob/File input decoded inside the provider: provider owns and closes the temporary ImageBitmap.
- Caller-supplied ImageBitmap/HTMLImageElement/drawable: provider borrows it and never closes it.
- Raw ImageData-like input remains zero-copy.

## Strategic decision
Do **not** keep the v0.63.6 full-resolution shared bitmap alive until Heavy Vision merely to remove another decode. That could trade a decode for a much larger mobile memory lifetime. Provider-level reuse will only be expanded when a bounded prepared representation can be shared without extending full-resolution resource lifetime.

## Tests
Regression tests verify both borrowed-resource preservation and owned-resource release.

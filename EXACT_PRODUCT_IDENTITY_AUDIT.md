# SeeMind v0.65.5 — Exact Product Identity Audit

SeeMind already had a local browser barcode provider, OCR, general visual identity, entity verification, search evidence, consensus, and Teacher infrastructure. The missing layer was deterministic evidence fusion answering: “which exact product/variant is this?”

The new identity object keeps barcode, OCR package fields, and visual candidates attributable. Valid GTIN/EAN/UPC codes are checksum-validated. Conflicting valid codes are reported rather than silently merged. Vision alone is intentionally insufficient for an exact variant because visually similar packaging can represent different sizes, formulas, markets, or revisions.

This is not a shopping subsystem. Exact identity is a general evidence primitive that can later support price comparison, ingredients, manuals, compatibility, translation, authenticity checks, and current-information retrieval.

Strategic rule: current price comparison must follow exact identity; search results must not be allowed to redefine the photographed product merely because a result looks similar.

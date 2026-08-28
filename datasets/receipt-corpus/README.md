# Real Receipt Benchmark Corpus

This directory is intentionally empty of real receipts in source control.

A benchmark case consists of:
- a redacted receipt image under `images/`
- a reviewed Ground Truth JSON record
- provenance flags confirming consent and redaction

Ground Truth uses integer minor currency units (centavos), e.g. MXN 656.38 = `65638`.

A case is **not benchmark-eligible** until:
- annotation status is `reviewed`
- `reviewedBy` is present
- consent is confirmed
- image redaction is confirmed
- corpus validation passes

Do not place unredacted customer names, phone numbers, emails, CURP, RFC, full payment-card numbers, bank-account data, QR payloads, or other unnecessary personal data in the benchmark corpus.

The v0.30 tooling provides text-side sensitive-data scanning, but image redaction still requires human confirmation. The system does not claim an image is redacted merely because OCR text looks clean.

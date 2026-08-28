# Start Real-World Testing — v0.70.0

This build is architecture-frozen for field testing.

## Before opening the app in your normal development/deployment environment

1. Install dependencies using the project's normal npm process.
2. Run `npm test` — expected: **883 / 883 PASS**.
3. Run `npm run audit:release` — expected: `ok: true`.
4. Run `npm run build` in an environment with Vite installed.
5. Start with normal user flows; do not begin by opening Pilot Lab.

## First 10 field tests

1. Clear product package, simple “这是什么？”
2. Product with tiny model text.
3. Similar product variants / model ambiguity.
4. Mexican receipt with SUBTOTAL / IVA / TOTAL.
5. Receipt with `$` visually close to `5`.
6. Blurry or reflective image.
7. Mandarin voice question.
8. Spanish voice question.
9. Mixed image + follow-up “这个哪里可以买？”
10. A deliberately difficult case Student cannot solve — verify Teacher escalation and verification.

For every failure, record the original input and classify it before changing architecture.

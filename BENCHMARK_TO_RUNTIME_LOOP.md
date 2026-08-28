# SeeMind v0.63.0 — Benchmark-to-Runtime Evidence Loop

## Goal
Close the loop between real-world benchmarking and actual runtime routing without allowing one attractive Lab score to become a production default.

## Previous gap
SeeMind already had:
- real Corpus / Pilot Lab
- Vision and Voice benchmark competition
- release gates
- promotion policy
- canary policy
- stored Lab results

But the production Vision and Voice routers did not consume those Lab results. The Lab could therefore become a measurement island.

## Runtime evidence policy
A new runtime policy converts qualified Lab results into ranking evidence.

Lab evidence can:
- give a small positive bias to a promoted engine
- give a stronger bias to one clear canary winner
- penalize an engine with measured regression

It cannot:
- bypass capability checks
- bypass health checks
- bypass privacy/local-only policy
- bypass memory/device budget
- bypass language compatibility
- force an unavailable engine to run

## Hard evidence requirements
Runtime routing ignores Lab evidence unless:
- at least 12 real benchmark cases were measured
- the result is no older than 30 days
- Promotion policy marked the engine eligible

A critical bug was also fixed: Competition previously shrank the minimum promotion case count to the size of the current corpus. A one-case corpus could therefore satisfy the sample requirement. Promotion now always requires at least 12 cases.

## Vision
Vision Lab engines using ids such as `visual:<providerId>` are mapped back to the real runtime provider id. Runtime provider ranking then receives only a bounded evidence adjustment.

## Voice
Voice runtime ranking uses the same evidence policy. Today WebSpeech may remain the only live engine on many devices, so Lab evidence cannot manufacture additional runtime engines. When a benchmarked engine is truly installed and runtime-capable, its qualified evidence can influence ranking.

## Principle
Benchmark results are evidence, not authority. Unified runtime capability/health/device/privacy gates remain authoritative.

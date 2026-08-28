# SeeMind v0.66.9 — Provider Diversity & Resilience

SeeMind should exploit specialists that are proven on the current capability/task, while preserving a small bounded path for new eligible specialists to prove themselves.

Rules:
1. Capability, safety, privacy, user controls and provider health are hard gates before exploration.
2. Small samples are shrunk toward a neutral prior; 1/1 is not treated as 100% proven.
3. Exploration is bounded (maximum 20%, default 8%) and deterministic per request key.
4. Failure resilience uses an ordered chain of already-eligible providers; an unhealthy provider is not kept as a preferred candidate.
5. Exploration changes who is tried, never whether evidence verification is required.

This is anti-lock-in without random routing.

# SeeMind v0.66.0 — Progressive Response & End-to-End Latency Audit

SeeMind already measured first-useful latency in local perception, voice partial latency, benchmark latency, and runtime budgets. The missing product behavior was a single presentation policy that could surface useful progress early without inventing an answer.

The new progressive response layer is deliberately non-authoritative. It cannot route, change evidence, or produce conclusions. It only exposes monotonic stages and timing. Late asynchronous events cannot move the UI backwards. The first-useful timestamp is committed once.

Strategic rule: optimize time to first useful understanding, but never trade away evidence quality by presenting a tentative perception event as a verified conclusion. Heavy local work, Search, and Teacher remain governed by their existing budgets and verification paths.

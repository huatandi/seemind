# SeeMind v0.65.8 — Voice Reality Audit

SeeMind already had a provider-neutral voice registry, multilingual adaptive routing, Web Speech and experimental local engines, first-partial/final latency telemetry, context rescoring, outcome feedback, voice benchmarks, and conversation sessions. The missing product behavior was turn continuity: explicit correction and bounded recovery without re-running visual perception.

## Rules
1. Context may rank close ASR alternatives but cannot silently overpower acoustics.
2. Only explicit correction language may amend a previous utterance.
3. A follow-up about the current image reuses the visual observation.
4. Technical ASR failure is not automatically a Teacher problem; local fallback/retry/text comes first.
5. Retry is bounded. Microphone permission denial requires user action rather than retry loops.
6. Continuous conversation does not mean permanently open microphone. Listening remains user-controlled.

This keeps SeeMind aligned with “see, understand, act”: voice is an ear and interaction channel, not a second brain.

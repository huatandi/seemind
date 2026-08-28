# SeeMind v0.63.2 — Scenario-aware Routing

## Goal
Use proven real-world benchmark experience at runtime without creating a second router or allowing a few attractive cases to rewrite production behavior.

## What changed
Benchmark failure patterns saved in Lab results can now become bounded scenario evidence for the existing Vision and Voice runtime routers.

Examples:
- low light
- blur
- far distance
- multiple objects
- small target
- text interference
- shop/street/vehicle noise
- far microphone
- mixed language
- numbers/amounts
- brand/model terms

## Hard gates
A scenario result can influence runtime only when:
- the engine was promoted
- evidence is from the same device cohort
- the result is fresh (30 days by default)
- that exact scenario has at least 12 cases
- there are at least two qualified engines for comparison
- the winner has a meaningful scenario advantage

Scenario evidence is capped to a small ranking adjustment. It cannot bypass capability, health, privacy, language, installation, or device-budget gates.

## No leakage
An engine that is strong in `shop_noise` receives no advantage for `numbers` unless it also has qualified `numbers` evidence. A low-light advantage does not become a universal Vision preference.

## Current-scene detection
Vision scenarios are derived after Fast Triage so current image evidence such as low brightness or support-text mode can be used. Voice scenarios are derived only from observable/current request hints such as numeric/model intent, language mode, or explicit environment hints.

## Learning loop
real cases -> benchmark -> failure patterns -> scenario evidence -> bounded runtime bias -> new benchmark evidence

This is practical experience learning, not on-device large-model training.

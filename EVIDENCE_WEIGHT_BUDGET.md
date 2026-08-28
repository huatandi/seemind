# SeeMind v0.63.4 — Unified Evidence Weight Budget

## Audit finding
The runtime candidate gates were correct, but qualified ranking evidence was added independently:
- Vision Autotune: up to +0.08
- Lab/Canary: up to +0.16
- Scenario: up to +0.12
- Outcome validation: up to +0.06

Vision could therefore receive up to +0.42 of positive auxiliary evidence after the core score. Voice could receive up to +0.34. More importantly, Autotune, Lab promotion and Scenario evidence are correlated because they originate from benchmark observations. The same underlying evidence could be rewarded multiple times.

## Fix
A single `Evidence Weight Budget` now composes all auxiliary ranking evidence.

### Budgets
- correlated benchmark family positive budget: +0.16
- total positive auxiliary evidence budget: +0.20
- total negative auxiliary evidence budget: -0.28

Autotune + Lab + Scenario share the benchmark-family budget. Outcome validation remains a distinct real-runtime signal, but the final combined positive evidence still cannot exceed +0.20.

## Authority boundary
Evidence is only applied after existing hard gates:
- capability
- local/privacy policy
- device class
- memory budget
- health/readiness
- installed/available engine

The budget does not make an ineligible engine eligible.

## Auditability
Routers now expose:
- raw evidence deltas
- applied evidence deltas
- whether capping occurred
- the final evidence delta
- active budgets

This makes future tuning inspectable instead of hiding multiple bonuses inside one score.

## Principle
Core capability/reliability/latency/device fit remains the main score. Experience refines a qualified choice; it cannot become a second brain or overpower the mainline.

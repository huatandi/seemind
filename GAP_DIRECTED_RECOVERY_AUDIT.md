# SeeMind v0.64.7 — Gap-Directed Recovery

## Purpose
A partial Goal Satisfaction result must not cause the whole workflow to restart. Recovery reuses the existing Task Graph and completed evidence.

## Boundary
Goal Satisfaction reports the missing condition. Gap-directed recovery maps that gap onto nodes already present in the graph, reopens the smallest useful branch, clears only receipts for reopened nodes, and leaves unrelated completed branches intact.

## Examples
- `freshness_evidence_missing`: reopen fresh search/retrieval and downstream compare/final nodes; preserve OCR, translation, and identity.
- `identity_not_resolved`: reopen identity and identity-dependent descendants; preserve independent visible-text work.
- `requested_comparison_not_completed`: reopen comparison and its final descendants only.
- blocked/user evidence required: do not replan.
- unknown gap: do not guess and do not restart everything.

## Budget and loop safety
Graph lifetime counters are preserved. Recovery is an explicit operation rather than an automatic closure loop, preventing silent infinite retries and hidden provider cost.

## Architecture
No new Brain, Router, universal Planner, or Orchestrator was introduced. The implementation is a thin recovery policy over the existing graph/checkpoint/receipt architecture.

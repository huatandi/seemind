# SeeMind v0.65.6 — Grounded Product Search & Price Comparison Audit

The system already had freshness routing, identity gates, search planning, source quality, evidence consensus, and exact product identity. The missing link was deterministic normalization and same-product filtering of offers before comparison.

## Non-negotiable order
Exact identity → current search → candidate offer extraction → same-product verification → availability/cost normalization → comparison → recommendation.

A search result may contribute current market evidence but may not redefine what was photographed. A lower price for a different size/model/variant is not a bargain; it is a different product. Out-of-stock prices cannot be winners. Known shipping participates in total cost. Unknown shipping, membership restrictions, and expiring promotions remain visible uncertainty rather than being silently flattened into one number.

This remains a general SeeMind capability, not a shopping application. It can answer a user asking where a photographed product is currently cheaper while preserving the system's evidence and freshness principles.

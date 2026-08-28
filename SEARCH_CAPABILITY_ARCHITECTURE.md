# SeeMind Search Capability Architecture

## Goal
`SEARCH` is an orchestration route, not a provider type. The retrieval layer decides what kind of external knowledge capability is most appropriate.

## Capability Registry
Current capability classes:
- `web_search` — broad/current public Web retrieval.
- `image_search` — visual similarity/reference retrieval.
- `official_source` — government, institution, canonical official sources.
- `manual_documentation` — manufacturer manuals and technical documentation.
- `product_model` — model/spec/product-oriented databases.
- `maps_local` — local/place/business/location sources.
- `specialist_database` — domain databases such as plant/animal/scientific resources.

## Routing
Knowledge Retrieval declares needs: freshness, authority, image similarity, local, product, specialist, and preferred source types.
The Registry ranks only available capabilities and returns:
1. primary capability,
2. bounded fallbacks,
3. auditable selection score/reason.

## Execution discipline
Unified Orchestrator still authorizes the top-level `SEARCH` route.
Execution Dispatcher still owns execution authority.
The Search Executor uses the Registry only to choose the appropriate retrieval instrument inside the approved SEARCH scope.
Every outgoing query still passes Search Privacy Gate + Query Sanitizer.
Every returned source still enters Source Provenance + Verification Core.

## Fallback
A specialized provider failure may fall back to another Registry-approved capability. Attempts are recorded. The Registry never invents availability: providers without an implementation are unavailable.

## Important boundary
This release creates the capability-routing architecture. It does not pretend that Image, Maps, Official, Manual, Product, or Specialist providers are already connected. The default Gateway may still expose only generic Web search, and currently its default search remains unconfigured.

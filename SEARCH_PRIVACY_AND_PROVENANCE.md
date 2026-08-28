# SeeMind Search Privacy & Source Provenance

## Principle
Internal understanding may use rich OCR, user speech and context. External retrieval receives only the minimum necessary query.

## External search gate
All Web search execution paths must pass:
1. Search intent / retrieval planning.
2. Search Privacy Gate.
3. Query Sanitizer.
4. Optional consent policy.
5. Provider execution.
6. Source Provenance ingestion.
7. Evidence / Verification.

## Query minimization
The sanitizer removes or abstracts common sensitive values including:
- Email
- Phone
- Bank/card/account-like numbers
- CLABE
- RFC
- CURP
- Long alphanumeric reference identifiers containing digits
- IP addresses

The Privacy Gate must not blindly remove normal descriptive language. Privacy rules are regression-tested for over-redaction.

## Source provenance
Each external source receives a canonical provenance record:
- sourceId
- URL / hostname
- title / publisher
- source type
- publishedAt / accessedAt
- fetchedVia
- query fingerprint
- requestId
- canonical/upstream source
- license metadata
- attribution requirement
- cache policy

Unknown license remains explicitly `unknown`; SeeMind must not infer commercial reuse permission from accessibility.

## Responsibility boundary
Search snippets are evidence candidates, not verified facts. Verification Core remains the only acceptance authority for retrieved results.

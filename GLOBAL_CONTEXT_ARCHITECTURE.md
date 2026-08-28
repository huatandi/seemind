# SeeMind Global Context Architecture

## Product principle
SeeMind Core is global. It must not bind itself to one country, region, language, currency, AI vendor, search company, cloud, map provider or specialist database.

## Context dimensions are independent
A single request can legitimately have different regions:
- `userRegion` — runtime/user-location hint.
- `questionRegion` — region explicitly implicated by the user's question.
- `objectRegion` — origin/applicability region of the photographed object/entity.
- `sourceRegion` — applicability of a retrieved source.
- `jurisdiction` — legal/regulatory region relevant to the requested decision.

These values must not be collapsed into one `country`.

Example:
- userRegion = MX
- language = zh
- objectRegion = JP
- questionRegion = US
- jurisdiction = US

This is not a conflict to “fix”; it is a multi-region problem to preserve.

## Locale dimensions
Global Context also carries:
- language
- documentLanguage
- locale
- currency
- measurementSystem
- timezone

Browser locale/timezone are hints, not proof of jurisdiction or precise physical location.

## Architecture rule
Country-specific behavior belongs in replaceable Region/Locale/Data/Policy packs or specialist parsers. Core defaults must remain neutral.

Mexico-specific receipt parsing, RFC/CLABE recognition and golden cases may remain as supported regional capabilities. They must not define global defaults.

## Provider routing
Capability Registry may consider target region/jurisdiction when ranking providers, but provider identities remain configuration. A provider can advertise supported regions; SeeMind Core does not hardcode a country-provider pair.

## Money
Universal Facts no longer assume MXN. If currency is unresolved, the unit is `XXX-minor`. A region-aware caller can supply MXN, USD, JPY, EUR, etc.

## OCR
Core OCR defaults are neutral (`auto` / no locale). Language- or country-specific normalization can still be selected explicitly when evidence supports it.

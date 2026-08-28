# SeeMind v0.63.9 — Active Vision / Next Best Evidence

## Why
v0.63.8 made semantic uncertainty explicit, but a missing brand/model capability still tended to jump directly to Teacher/tool escalation. That wastes an inexpensive source of decisive evidence: the user's camera.

## Design
No second router or problem solver was added. A small policy module translates an already-known visual capability gap into one highest-value capture request. `resolution-router` remains responsible for deciding whether to collect evidence, escalate, or answer locally.

## Supported evidence gaps
- specific identity → brand/model/nameplate/label view
- visual grounding → referenced region + context
- anomaly inspection → abnormal area + surrounding structure
- component parts → close component view + connection context
- spatial relationships → relevant objects together
- color/state → indicator/screen view
- object identity → whole object + context
- scene context → wider scene

## Anti-loop boundary
Only gaps with a concrete camera action enter Active Vision. Unknown/non-visual capabilities do not fabricate photo guidance and remain eligible for Teacher/tool escalation.

## User-effort rule
Only one next-best capture is requested at a time. New evidence should re-enter the existing Problem State and capability router before another request is made.

## Truthfulness
Active Vision does not convert UNKNOWN into a guess. It converts UNKNOWN into a targeted evidence request.

# SeeMind v0.62.7 — Problem State Continuity & Anti-Pollution

## Purpose
This release hardens multi-turn real-world problem solving. It does not add a new model, teacher, provider, router, or second brain.

## Fixed: repeated text follow-ups were re-adding the same photo
`buildUniversalExplanation()` can revisit the same current observation on every user follow-up. The evidence graph previously treated each revisit as a new photo.

Now photo evidence is keyed by the stable observation id. Reusing the same image during follow-up conversation returns `same_observation` and does not inflate photo count or fabricate additional visual evidence.

## Fixed: new object could inherit the old target forever
Brain Problem State previously preferred the existing target and rarely switched once set.

Problem State is now continuity-aware:
- `same_object` / `probably_same_object` / `same_observation`: preserve object-specific state.
- `new_object` / `likely_new_object`: start a fresh object-scoped state while preserving only bounded global constraints/route history.
- `unresolved`: do not merge ambiguous new visual facts into the active object; quarantine them until the photo relationship is clearer.

This prevents symptoms, attempts, facts and risks from one device contaminating another.

## Fixed: stale Task Package could influence a new user task
A new user question could enter Brain Mainline with the previous turn's Task Package before a fresh package was compiled. That package might contain old Search completion, consensus, teacher state, or retrieval evidence.

Brain Mainline now accepts a Task Package only when `taskPackage.task.id === task.id`. A new task therefore starts orchestration assessment without stale execution state.

## Strengthened: "already tried" means semantic action, not sentence similarity
Troubleshooting now attaches canonical action ids such as:
- `power_cycle`
- `basic_power_path`
- `battery_replaced`
- `cleaned`
- `reinstalled`
- `inspect_indicator`

Equivalent wording is deduplicated by action id. A successful or failed attempt is also recorded in `attemptResults` and propagated into Brain Problem State.

Example:
"I already restarted it and it still doesn't work"
prevents the next step from simply sending the user back to the same basic power-cycle path.

## Boundary
This remains short-session problem continuity. It is not long-term personal memory.

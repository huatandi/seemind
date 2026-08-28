# SeeMind v0.67.1 — Real Problem Resolution & Action Continuity

SeeMind's success condition is not "an answer was generated" and not "a specialist API returned". It is whether the user's actual goal is resolved.

Resolution states distinguish investigating, action-pending, evidence-complete (`resolved_candidate`), and user-confirmed resolved. External specialist outputs remain candidate evidence until verified. A user's explicit report that the issue remains unresolved overrides machine assumptions.

For multi-part questions, completion is tracked per goal/subgoal. The next action must target an unresolved goal and must not repeat already completed work.

This closes the loop: **See → Understand → Act → Resolve**.

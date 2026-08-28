# SeeMind v0.63.5 — End-to-End Mainline Compression Audit

## Purpose
Compress repeated work in the existing mainline without deleting necessary reasoning, evidence, safety, verification, or referral stages.

## Finding 1: initial image was understood twice
`observeImage()` already performs:
- visual analysis plan
- problem understanding
- resolution planning

Immediately afterward, initial `buildUniversalExplanation()` repeated Problem Understanding and Resolution Planning even though the user had not added any new speech/text.

### Fix
For the initial image-only explanation:
- reuse `observation.problem`
- reuse `observation.resolution`
- reuse the existing `visual_capability_plan`

As soon as the user adds new text/speech/reference, reuse is invalidated and fresh multimodal understanding/planning runs.

This is safe compression, not skipped reasoning.

## Finding 2: semantic observation state accumulated across turns
Each follow-up appended a new:
- `problem_understanding`
- `resolution_plan`

but old versions remained in `observation.observations`.

Some downstream readers use `findObservation(kind)`, which returns the first match. That could expose an old resolution plan instead of the current one.

### Fix
Dynamic semantic artifacts now use replace semantics:
- multimodal_context
- multimodal_problem_prompt
- problem_understanding
- resolution_plan
- explanation_action_contract
- teacher_explanation_prompt

Current Observation contains the current semantic state. Historical conversation/problem attempts remain in their dedicated Conversation / Problem State structures.

## Deliberately not compressed
The audit did not remove:
- Safety
- Answerability
- Unified Orchestrator
- Verification
- Task Package compilation when a new task is created
- Search / Teacher re-entry
- Problem State continuity
- evidence boundaries

Cheap context assembly was not removed merely to reduce line count. Compression is applied only where work or state was actually duplicated.

## Product principle
Do each necessary stage once per relevant evidence state. Recompute only when new evidence or user intent changes the meaning of the problem.

# SeeMind v0.62.8 — Problem Lifecycle

## Goal
A real problem is not permanently `investigating`. Users solve it, pause it, abandon it, resume it, and sometimes report that it returned. This release gives the existing Problem State a lifecycle without introducing another brain.

## Lifecycle
- `investigating` — active problem
- `resolved` — user reports that the problem is fixed
- `paused` — user intentionally postpones work
- `closed` — user explicitly stops this problem
- `reopened` is represented as a transition back to `investigating` with a new lifecycle generation

## Rules
### Resolve
When the user reports that it is fixed:
- session becomes `resolved`
- resolution timestamp is recorded
- guided troubleshooting stops
- Brain Problem State clears active unknowns and next action

### Recur / reopen
If a resolved problem later returns:
- status returns to `investigating`
- resolution is no longer treated as current
- lifecycle generation increments
- old evidence/symptoms become historical context
- previous attempts remain history; they are not erased

This prevents the system from treating "it worked yesterday" as proof that it works now.

### Pause
"先不管 / later / más tarde":
- status becomes `paused`
- troubleshooting planner produces no next step
- history is preserved

### Resume
An explicit continue/resume instruction reactivates a paused or closed problem.

### Close
"关闭这个问题 / 不用处理了":
- status becomes `closed`
- no troubleshooting step is generated until explicit resume

## Boundary
Lifecycle is problem-scoped working state, not long-term personal memory.

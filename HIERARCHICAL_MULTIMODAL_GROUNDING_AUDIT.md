# SeeMind v0.64.2 — Hierarchical & Compound Visual Grounding

## Goal
Strengthen the existing grounding path rather than create another multimodal router.

## Same-region compound rule
“右边那个红灯” may resolve only when one visual region satisfies both RIGHT and RED INDICATOR evidence. A red object on the left plus a green object on the right must not be merged into a fictional right-red object.

## Parent-scoped ordinal rule
For phrases such as “左边第二个”, the system may:
1. select one unique spatial parent/container;
2. find object children geometrically inside that parent;
3. establish a clear row/column order among those children;
4. resolve the ordinal only inside that parent.

The provider's detection array order is never semantic order.

## Parent/child identity
The parent phrase and child ordinal remain different grounded references. This prevents “left box” and “second indicator inside left box” from collapsing into the same entity.

## Uncertainty boundary
If there are multiple equally plausible parents, unclear containment, or no clear child ordering, the hierarchical reference remains unresolved. Existing Active Vision can then request a clearer view.

## Non-goals
No new Brain, Orchestrator, provider, model, or parallel grounding architecture was added.

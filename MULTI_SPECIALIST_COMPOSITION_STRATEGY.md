# SeeMind v0.67.0 — Intelligent Multi-Specialist Composition

Complex questions should be decomposed by capability, not broadcast to many AI models for majority voting.

Example: identify a product → obtain current retail facts and nearby options in parallel → reason over verified results → SeeMind synthesizes.

Principles:
- One bounded role per residual subproblem.
- Preserve Student-known facts; specialists do not redo reliable work.
- Dependencies are explicit and form a small DAG.
- Parallelize only independent jobs.
- Upstream external outputs remain candidate evidence and must be verified before dependent reasoning.
- Final answer authority remains with SeeMind orchestration/evidence policy.
- Maximum five external jobs per composition.

This lets SeeMind use an ecosystem of specialists without pretending to be a universal master or becoming a costly multi-AI voting system.

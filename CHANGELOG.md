# SeeMind Changelog

## 0.70.0 — Architecture Freeze & Real-World Test Candidate

- Completed the final architecture slimming pass without removing useful perception, understanding, evidence, planning, Teacher, or learning logic.
- Extracted the 250+ line Pilot Lab / benchmark UI from the production entry point. The Lab now lazy-loads on demand; normal recognition/voice/Teacher startup no longer owns the full benchmark implementation.
- Reduced `apps/web/src/main.js` from 781 lines to about 556 lines while preserving Pilot Lab capability in `runtime/pilot-lab-runtime.js`.
- Removed the truly empty `core/shared/result.js`; no behavior or API was lost.
- Added an architecture-freeze contract defining the canonical decision authorities and a release-integrity audit to prevent duplicate routing brains or stale release baselines.
- Declared v0.70.0 the real-world test candidate: further architecture changes now require evidence from real device/image/voice tests rather than aesthetic refactoring alone.

## 0.69.1 — Core Reduction Audit IV: Remove Obsolete Compatibility Brains

- Removed `teacher-performance.js`; its boolean success/failure learning was weaker than the retained verified outcome-learning model.
- Migrated Teacher ranking tests to the canonical outcome store, preserving latency and task/capability-specific learning.
- Removed the deprecated `decision-engine.js`; Unified Orchestrator is now the only local/Teacher routing authority.
- Migrated legacy routing tests to Unified Orchestrator rather than deleting their behavioral safeguards.
- Added reduction guards preventing either obsolete compatibility brain from returning.
- No useful perception, understanding, evidence, planning, outcome-learning, or Teacher-selection logic was removed.

## 0.69.0 — Evidence Authority Convergence

- Promoted the existing task-aware evidence authority logic into the canonical claim-verification path instead of creating another evidence brain.
- Claim judgments now retain which source is naturally strongest for that claim type (for example barcode/model, arithmetic/receipt total, retailer/current price, government/law).
- Verification Core remains the only final acceptance authority; task-aware authority is an internal weighting component, not a competing verdict engine.
- Evidence verdict summaries now state this ownership explicitly.
- Reclassified `task-aware-authority.js` from staged logic to a runtime-internal Verification component.
- No domain feature was added and no good evidence logic was removed.

## 0.68.9 — Core Reduction Audit III: Preserve Intelligence

- Removed the accidentally resurrected `specialist-selector.js`; the existing reduction guard now passes again.
- Preserved verified provider-outcome learning and exposed it through the canonical Intelligence Gap Router surface.
- Added an explicit Core lifecycle policy: RUNTIME, LAB/EVALUATION, STAGED/PROMOTION CANDIDATE, and DEPRECATED/REMOVE.
- Classified valuable zero-production-import modules as staged or evaluation assets instead of mechanically deleting them.
- Added guards proving that verified-outcome learning still changes teacher choice after reduction.
- No user-facing feature was added. Reduction now optimizes decision ownership and maintenance surface, not raw line count.

## 0.68.8 — Core Reduction Audit II

- Removed duplicate perception-quality/recovery coordination from the Web runtime; production now enters those policies only through the canonical Perception Boundary.
- Promoted `specialist-capability-plan` from test-only logic into production composition instead of deleting it: one capability map now serves both simple and composed specialist work.
- Removed duplicated hard-coded capability arrays from multi-specialist composition while preserving its DAG, dependency, bounded-job and candidate-evidence logic.
- Added `local_discovery` to the canonical provider-neutral capability plan so nearby/location work follows the same capability authority.
- Added reduction guards preventing Web runtime from bypassing the Perception Boundary and preventing composition from drifting into a second capability table.
- No user-facing feature was added; good logic was retained and promoted, duplicate wiring was reduced.

## 0.68.7 — Core Reduction Audit I

- Performed a production import-graph audit instead of adding another architecture layer.
- Removed the obsolete `specialist-selector.js` compatibility module after confirming it had zero production callers.
- Migrated specialist capability/outcome/failover tests to the canonical `Intelligence Gap Router` + `Teacher Router` path.
- Added a reduction guard so the removed selector cannot silently return as a second teacher-ranking authority.
- Preserved capability planning, verified-outcome learning, bounded exploration and failover behavior.
- No user-facing feature was added; this release makes the codebase physically smaller and the teacher-selection authority structurally singular.

## 0.68.6 — One Understanding Boundary

- Added one canonical boundary between multimodal perception and problem reasoning.
- Removed the duplicate intent regex classifier from Problem Understanding; Universal Intent Router is now the single intent authority.
- Centralized aggregation of perception/reference unknowns so downstream Brain/Orchestration consumes one unresolved set.
- Multimodal Fusion keeps only a compatibility intent hint and explicitly delegates final intent authority to the Understanding boundary.
- Problem Understanding is now primarily a problem-view adapter rather than a second interpretation engine.
- No new domain feature was added; this release reduces duplicated interpretation logic.

## 0.68.5 — One Perception Truth Boundary

- Added one canonical boundary for OCR, vision and voice outputs before reasoning.
- Perception engines now produce observations/candidates only; they cannot self-promote outputs to verified facts.
- Quality gating and targeted recovery are hidden behind the same perception boundary instead of becoming separate product concepts.
- Multimodal fusion explicitly carries epistemic observation status and delegates fact authority to the Evidence layer.
- Weak perception uses targeted local recovery; whole-pipeline reruns remain disallowed by default.
- No new domain feature was added; this release removes ambiguity about where perception ends and truth verification begins.

## 0.68.4 — One Teacher Ranking Authority

- Removed duplicate provider scoring logic between Specialist Selector and Teacher Router.
- Teacher Router is now the single eligibility/scoring authority for capability fit, evidence, freshness, reliability, learned success, language and latency.
- Intelligence Gap Router remains the single production facade and owns gap semantics, bounded exploration and ordered failover.
- Specialist Selector is retained only as a compatibility facade for existing tests/callers and delegates ranking to Teacher Router.
- Capability-aware verified outcome stores now feed the same canonical ranking path.
- Web Teacher routing passes the full task package so privacy/freshness/language constraints are not lost during specialist selection.
- No new product feature was added; this release removes duplicated decision logic.

## 0.68.3 — Intelligence Gap Routing Simplification

- Added one canonical production facade for borrowing external intelligence: `intelligence-gap-router`.
- Runtime callers now describe the missing capability once instead of directly coordinating specialist ranking and exploration details.
- Capability fit, learned outcomes, bounded exploration and failover remain internal policy details behind one stable entry point.
- Web Teacher execution now consumes the canonical intelligence-gap route and ordered failover chain.
- Local-answerable work produces no intelligence gap; unavailable specialist capability fails explicitly rather than falling back to brand order.
- No new user feature was added: this release reduces orchestration surface while preserving provider neutrality and verified-outcome learning.

## 0.68.2 — Canonical Problem State Convergence

- Made `ProblemSolvingSession` the canonical lifecycle source for production reasoning.
- Brain `ProblemState` is now explicitly a disposable derived working view whenever a canonical session exists.
- Removed the duplicate persistent `currentBrainProblemState` from the Web runtime.
- Brain routing can no longer silently carry stale lifecycle/unknown state across turns when the canonical session says otherwise.
- Kept legacy previous-state support only as a compatibility fallback for non-session callers.
- Added regression tests proving canonical session state overrides stale derived Brain state.

## 0.68.0 — Runtime Convergence & Architecture Cleanup

- Began runtime convergence instead of adding another isolated intelligence layer.
- Added a production runtime convergence facade that promotes Perception Quality Gate, Adaptive Recovery, Multi-Specialist Composition, Planning Escalation and Problem Resolution into the web mainline.
- Image/OCR observations now receive a runtime quality/recovery assessment before higher-level reasoning consumes the observation trail.
- Complex user questions now produce a bounded composition/planning/resolution runtime snapshot instead of leaving those modules test-only.
- Web Teacher execution now uses provider-neutral specialist capability ranking when provider profiles match the task, while preserving the existing Teacher fallback path when no specialist ranking is applicable.
- Runtime metadata explicitly declares Problem Session as the intended source of truth and Brain Problem State as a derived working view, preparing removal of duplicate lifecycle ownership in a later cleanup.
- Added integration tests proving these formerly isolated architecture modules are reachable from production runtime adapters.

## 0.67.4 — Adaptive Perception Recovery & Cross-Modal Verification

- Added failure-specific perception diagnosis instead of blindly rerunning entire image/OCR/voice pipelines.
- Money symbol/digit confusion uses targeted crop, preprocessing variants, local OCR recheck and semantic arithmetic/payment consistency checks.
- Model/SKU ambiguity uses token-level recovery plus barcode/vision cross-check.
- Voice ambiguity uses the disputed audio span plus visual/OCR/dialogue context.
- Added cross-modal verification requiring independent support; one modality cannot verify itself.
- Strong cross-modal contradictions remain conflicts instead of being averaged into false confidence.
- Recovery remains local-first, bounded and preserves original observations.

## 0.67.3 — Perception-to-Intelligence Quality Gate

- Added a modality-aware quality gate between image/OCR/voice perception and higher reasoning.
- Engine output is never silently promoted to verified fact; even high-confidence perception remains an observation until evidence policy verifies it.
- Critical fields use stricter thresholds than ordinary descriptive observations.
- Competing high-confidence candidates trigger recovery instead of arbitrary guessing.
- Recovery is local/offline-first and bounded; Teacher perception rescue is available only when local recovery is insufficient and online escalation is allowed.
- Original observations are preserved through recovery for provenance and later comparison.

## 0.67.2 — Intelligent Planning Escalation

- Added explicit detection for problems whose decomposition itself needs a high-capability planning specialist.
- Simple/single-intent problems remain local; multi-intent, dependency-rich, multi-residual or low-confidence decomposition can request `complex_problem_decomposition`.
- Planning specialists receive a minimum-purpose brief and are explicitly denied provider-selection, execution, safety and privacy authority.
- Added local validation for planner task graphs: bounded job count, unique IDs, valid dependencies, no cycles and no redoing completed work.
- Accepted planner jobs remain candidate-evidence tasks and final execution authority remains with SeeMind.
- Planning capability is provider-neutral and can be fulfilled by whichever future specialist proves best.

## 0.67.1 — Real Problem Resolution & Action Continuity

- Added evidence-grounded resolution state separate from answer generation and specialist API completion.
- Tracks user goals/subgoals, verified completion, unresolved goals and resolution ratio.
- Added `resolved_candidate` to distinguish evidence-complete work from explicit user confirmation.
- Explicit user reports that a problem remains unresolved override apparent machine completion.
- Next-action derivation targets the remaining unresolved goal instead of repeating completed specialist work.
- Problem-solving sessions can now carry a structured resolution state without breaking the existing lifecycle API.

## 0.67.0 — Intelligent Multi-Specialist Composition

- Added bounded capability-specific job composition for complex real-world questions.
- Composition is not multi-model voting: each residual subproblem has one specialist role and explicit dependencies.
- Exact identity can become a prerequisite; downstream retail/local/reasoning specialists do not redo already-resolved work.
- Independent jobs can run in parallel; dependent reasoning waits for verified upstream evidence.
- Specialist outputs remain candidate evidence and final synthesis remains owned by SeeMind.
- Composition is capped at five jobs to prevent uncontrolled cost/latency fan-out.

## 0.66.9 — Exploration, Diversity & Provider Failure Resilience

- Added confidence-aware outcome shrinkage so tiny samples cannot masquerade as proven provider quality.
- Added bounded deterministic exploration among providers that already passed capability, privacy, health and user-control gates.
- Added ordered specialist failover chains; unhealthy providers are excluded before failover.
- Proven specialists remain the default. Exploration is capped and exists only to discover potentially better specialists without creating provider lock-in.
- Outcome learning now exposes evidence weight and confidence for safer selection decisions.

## 0.66.8 — Specialist Outcome Learning & Anti-Lock-in

- Added provider × capability × task outcome learning rather than a single provider reputation score.
- Technical API success is explicitly not factual/task success.
- Verified evidence is a strong positive signal; user correction, authoritative contradiction, unresolved residuals and technical failure are distinct negative signals.
- Specialist ranking can consume capability-specific learned outcomes while retaining compatibility with the existing performance store.
- Learning remains provider-neutral: new specialists can rise or fall from attributable outcomes without changing SeeMind core logic.

## 0.66.7 — Capability Intelligence & Best Specialist Selection

- Added provider-neutral residual-task capability planning.
- Added specialist ranking by capability fit, measured task success, reliability, evidence quality, latency and cost.
- Current-price/current-availability, official facts, visual/text residuals, coding, long-document, translation and frontier reasoning now have explicit capability classes.
- Added guard tests ensuring routing selects capabilities rather than AI brands.
- Specialist results remain subject to the existing evidence and verification pipeline.

## 0.66.6 — Task-Aware Evidence Authority & Specialist-Orchestration Discipline

- Added task-aware evidence authority so different claims prefer the evidence naturally suited to them instead of using one universal confidence hierarchy.
- Product identity favors barcode / official / label OCR; receipt totals favor arithmetic + OCR; current price/availability favors current retailer evidence; legal/safety claims favor authoritative public sources.
- Teacher evidence is explicitly treated as specialist candidate evidence, not a universal truth source or automatic winner over direct evidence.
- The authority layer has no routing or answer authority; Unified Orchestrator and existing verification/consensus layers remain in control.
- Strategic doctrine remains provider-neutral: SeeMind should orchestrate strong external specialists rather than attempt to reproduce a universal search engine or foundation model.

## 0.66.5 — Student Self-Knowledge & Uncertainty Calibration

- Added evidence-shape confidence calibration to detect dangerous Student overconfidence and wasteful underconfidence.
- Conflicts, unresolved fields, uncertain fields, and explicit limitations can only reduce confidence; calibration never manufactures confidence.
- Student collaboration briefs now carry calibration state into precision Teacher escalation.
- Precision escalation treats detected overconfidence as a residual verification need rather than allowing a high raw score to suppress help.
- Added regression tests for reliable confidence, safe unknowns, overconfidence, and unnecessary-Teacher risk.

## 0.66.4 — Student Accuracy Maximization & Precision Teacher Escalation

- Added a provider-neutral precision-escalation contract that describes only the Student's residual uncertainty instead of asking a Teacher to redo the whole task.
- Residual gaps are classified as evidence conflict, exact identity, barcode identity, text detail, capture quality, or semantic/visual residual.
- Teacher packages now preserve reliable Student facts, expose unresolved/verify fields and candidate hypotheses, and require Teacher output to return as a candidate for verification.
- Minimum-necessary sanitization preserves only the precision target, bounded candidates, ROI metadata, and residual instructions.
- No new routing authority was added; Unified Orchestrator remains the only final route authority and Verification Core remains the acceptance authority.

## 0.66.3 — Cold Start & Model Warmup Reality

- Adds a conservative runtime warmup coordinator with device-tier and Save-Data gates.
- Tesseract can preload only its JavaScript runtime during idle time; warmup performs no OCR recognition and downloads no local model assets.
- Low-power and Save-Data devices skip normal idle warmup; heavy models remain strictly on-demand.
- Adds cold / warm / hot startup classification so real-device benchmarks can separate first-use cost from reuse performance.
- Web startup schedules only the lightweight Tesseract runtime warmup and never blocks user interaction or First Useful Understanding.
- Warmup remains telemetry/optimization infrastructure with no routing or answer authority.

## 0.66.2 — Shared Image Pipeline & Zero-Waste Decode

- OCR candidate preprocessing now follows `DECODE_ONCE_DERIVE_MANY`: one source decode/resize/readback can produce several conservative OCR enhancement candidates.
- Existing `PreparedImageSource` is now reusable by fast triage and OCR preprocessing, so OCR can add zero source decodes when the web capture path already prepared the image.
- Prepared-source lifetime is held until the local observer has finished triage plus any primary OCR preprocessing; the web attachment path remains an independent borrower.
- Candidate canvases release backing stores eagerly and OCR candidate count remains hard-bounded to protect mobile memory.
- Critical-path OCR span records source-reuse telemetry so real-device benchmarks can verify whether decode reuse is actually paying off.
- No routing authority or new image brain was added.

## 0.66.1 — Real Mobile Critical Path

- Added a low-overhead, monotonic critical-path trace for the real local image-perception path.
- Measures fast triage, OCR preprocessing, OCR ensemble, heavy visual capabilities, first-useful, and local-perception completion.
- Produces ranked bottlenecks instead of hard-coded optimization guesses.
- Trace is telemetry-only and explicitly has no routing, evidence, or answer authority.
- Added regression coverage for bottleneck ranking, repeated-decode warnings, overlapping spans, and architecture authority boundaries.

## 0.66.0 — Progressive Response & End-to-End Latency

- Added a thin progressive-response presentation contract over existing first-useful and runtime latency telemetry; it has no routing or answer authority.
- First useful feedback is explicitly recorded once, while later asynchronous events cannot regress the visible UI stage.
- Fast triage now produces conservative, evidence-bounded first-useful wording instead of waiting for the entire perception pipeline.
- Web capture records first-useful and total perception timing for real-device measurement.
- Added regression tests for monotonic progress, first-useful timing, conservative wording, and separation from reasoning authority.

## 0.65.9 — Offline Reality & Model Resilience

- Added an explicit offline capability state: local abilities remain usable while fresh web search and Teacher are marked unavailable instead of failing ambiguously.
- Added deep model-cache integrity audit. Fast status may trust verified metadata, while audit re-hashes actual cached bytes and can remove corrupted assets for repair.
- Added storage preflight with reserve headroom before optional model installation; low-storage devices can fail before network transfer begins.
- Model Manager can surface `needs_repair` after a failed deep audit.
- Preserved verified-cache offline reuse and existing opt-in model delivery behavior.
- No new AI brain, model provider, search provider, or cloud dependency was introduced.

## 0.65.8 — Voice Reality & Turn Continuity

- Added a thin voice-turn continuity policy over the existing ASR router/executor, context rescoring, conversation session, and outcome feedback; no new voice brain.
- Explicit spoken corrections such as “不是十五，是五十” and “no es quince, es cincuenta” can deterministically amend the previous user utterance. Ordinary speech is never silently rewritten from conversational context.
- Continuation turns explicitly preserve the current visual context instead of implying a new perception pass.
- Added bounded voice failure recovery guidance for permission, offline/network, timeout/no-speech, fallback-engine, and exhausted-retry cases.
- The web voice mainline now applies explicit correction semantics before submitting the turn while retaining the existing low-confidence confirmation gate.
- Existing first-partial latency, multilingual routing, context-dominance safeguards, and conversation evidence remain authoritative.

## 0.65.7 — Difficult OCR Reality

- Shifted OCR work from architecture expansion to bounded recovery on difficult real-world captures.
- Added a provider-neutral OCR failure recovery policy over existing image quality, adaptive preprocessing, multi-pass OCR, ensemble, receipt arithmetic evidence, and Teacher infrastructure.
- Low contrast/dark captures prefer alternate conservative preprocessing; blur and glare produce concrete recapture guidance; missing decisive fields prefer text-focused crop; semantic conflicts request bounded alternate-engine verification.
- Recovery never authorizes guessing missing text or overwriting an already resolved field merely to satisfy arithmetic.
- Repeated OCR failure is bounded to two recovery attempts before minimum-necessary Teacher escalation is allowed.
- The real local Student OCR path now exposes `ocr_recovery` evidence, and callers can carry recovery-attempt state across retries.
- No new OCR engine, receipt brain, document app, or provider binding was introduced.

## 0.65.6 — Grounded Product Search & Price Comparison

- Added a deterministic, provider-neutral offer comparison layer; no shopping app, retailer binding, or new reasoning brain.
- Current-price search can use the exact-product search key rather than a fuzzy entity name.
- Search evidence now preserves structured offer fields such as price, currency, shipping, availability, channel, distance, promotion metadata, and product identity fields.
- Offer comparison is blocked until exact identity is grounded.
- Same-brand but wrong model/size/variant offers are rejected instead of being treated as cheaper matches.
- Out-of-stock headline prices cannot win. Known shipping is included in total cost; unknown online shipping is surfaced as uncertainty.
- Search results are not allowed to redefine the photographed product identity.

## 0.65.5 — Exact Product Identity

- Added deterministic product-identity evidence fusion over existing barcode, OCR, and vision outputs; no shopping app or new product brain.
- Product barcodes are checksum-validated before being treated as strong identity evidence.
- Multiple valid product codes create an explicit conflict instead of silent selection.
- Package text can contribute brand, model, size, and variant evidence; vision evidence may support brand/model but cannot by itself assert an exact package variant.
- Exact identity produces a provider-neutral search key for later current-price/search workflows.
- Universal explanation exposes exact product identity when the world router classifies the subject as a product.
- Price comparison remains blocked conceptually until exact identity is sufficiently grounded.

## 0.65.4 — Vision Failure Recovery

- Added a thin recovery policy over existing image-quality, preprocessing, active-vision, resolution, and Teacher infrastructure; no new vision brain or router.
- Blur/low-detail, exposure/contrast, glare/highlight clipping, target-region gaps, and missing whole-object context now produce bounded recovery actions.
- Cheap local enhancement/crop and a single useful recapture request are preferred before expensive external escalation.
- Repeated recovery failure is bounded; after two attempts the plan may escalate to Teacher using the existing minimum-necessary policy.
- Resolution mainline now exposes `visualRecovery` and can distinguish recoverable visual failure from exhausted recovery.
- Fast triage preserves preprocessing image-quality metadata when available.
- Added regression coverage for blur, glare, crop-first identity recovery, bounded escalation, and mainline capture guidance.

## 0.65.3 — Mobile Reality Benchmark Gate

- Shifted engineering focus from Core expansion to measurable mobile perception behavior.
- Benchmark device profiling now reuses the production device policy, preventing lab/runtime tier drift (especially iPhone/Safari hidden-RAM cases).
- Benchmark sessions now track optional first-useful latency, memory delta, and budget-overrun rate in addition to quality/success/total latency.
- Benchmark runner captures browser heap telemetry when available and accepts engine-reported telemetry when browsers hide it.
- Added a thin Mobile Reality Gate that converts benchmark evidence into PROMOTE_LOCAL / KEEP_LOCAL_WITH_DEFERRED_HEAVY_STAGE / PREFER_LIGHTER_LOCAL_OR_TEACHER recommendations.
- A model cannot be considered mobile-ready merely because recognition quality is high; latency, first-useful response, budget overruns, and memory pressure are first-class promotion criteria.
- No new perception brain, router, provider, or domain-specific capability was introduced.

## 0.65.2 — Mobile Reality Baseline

- Shifted engineering focus from new Core abstractions to the real mobile perception path.
- Fixed mobile capability inference: iOS/mobile browsers that hide `deviceMemory` are now treated as memory-uncertain rather than implicitly desktop-capable.
- Tightened visual memory and inference budgets for memory-unknown mobile devices while preserving a performance tier for devices with positive capability evidence.
- Perception budgets now expose device uncertainty and inherit the device-level visual memory ceiling.
- Fixed a real capture-flow gap: a question typed before choosing/taking a photo is now passed into fast triage, Universal Explainer, and task intent instead of being ignored. This lets requests such as “翻译这张图” route directly toward OCR/document understanding on the first pass.
- Added regression tests for conservative iPhone-like profiling, bounded mobile perception budgets, and high-end capability preservation.
- No new Brain, Router, Planner, Memory store, or domain-specific subsystem was introduced.

## 0.65.1 — Mainline Convergence

- Performed a v0.65 convergence audit instead of adding another Core subsystem.
- Found a real integration gap: Temporal Fact Continuity and Evidence → Final Answer Contract were well tested but not yet wired into the Universal Explainer runtime path.
- Universal Explainer now derives the current/history fact view from the existing Evidence Graph and exposes it as `factView`.
- Problem state now carries the same derived `factSnapshot` for conversational continuity; Evidence Graph remains authoritative.
- Universal Explainer now exposes `epistemicAnswer`, projecting observed facts, user reports, inferences, historical facts, conflicts, and unknowns to the user-facing boundary.
- HTML rendering visibly labels historical information and unresolved evidence conflicts.
- Added mainline integration tests to prevent these capabilities from becoming test-only/dead architecture.
- Fixed a real continuity bug discovered by the integration tests: text-only follow-up turns with the default empty observation object no longer create phantom photos/entities or switch the active entity.
- No new Brain, Router, Planner, Memory database, domain app, or specialist subsystem was added.

## 0.65.0 — Evidence → Final Answer Contract

- Added a thin epistemic projection between verified evidence and user-facing answers.
- Final-answer data can now explicitly separate current confirmed facts, user reports, inferences, historical facts, conflicts, unknowns, and provenance.
- Superseded/retracted/expired/conflicted evidence is excluded from live provenance and cannot silently become current evidence through answer composition.
- Temporal fact history can be surfaced as history without being merged into current truth.
- Verification conflicts and freshness/support gaps remain visible at the final-answer boundary.
- Extended the existing answer contract additively with optional epistemic and temporal metadata.
- Strengthened Teacher explanation rules so external reasoning cannot revive inactive evidence or blur current/history boundaries.
- No new Brain, Orchestrator, Memory store, or domain-specific answer engine was introduced.

## 0.64.9 — Temporal Fact Continuity

- Added a current-vs-history view over the existing Evidence Graph; no second memory database was introduced.
- Current entity facts are selected only from usable evidence semantics, so superseded/retracted/expired/conflicted evidence cannot silently resurrect in later conversation turns.
- Added fact reconciliation that preserves contradictory older facts as superseded history instead of overwriting them.
- Simultaneous contradictory active facts remain unresolved conflicts rather than being arbitrarily ordered.
- Conversation Session can carry a derived fact snapshot for continuity while the Evidence Graph remains the source of truth.
- Added regression coverage for temporal current-state selection, anti-resurrection, supersession history, concurrent conflict, and session snapshots.

## 0.64.8 — Evidence Semantics & Fact Lifecycle

- Added a domain-neutral evidence semantics contract separating observation, user report, OCR extraction, external source, inference, tool result, and teacher result.
- Added evidence lifecycle states: active, superseded, expired, retracted, and conflicted.
- Added observation/assertion timestamps, optional validity windows, provenance references, derivation links, and supersession links.
- Photo-derived claims now explicitly retain observation semantics and observation time.
- Field evidence now carries semantics without breaking the existing top-level field contract.
- Claim verification refuses superseded, retracted, expired, or conflicted evidence instead of silently treating it as a current fact.
- Added regression coverage for source-kind separation, temporal semantics, expiry, supersession history, and inactive-evidence rejection.

## 0.64.7 — Gap-Directed Recovery

- Added minimal recovery from Goal Satisfaction gaps by reopening only existing graph nodes that can close the gap plus their downstream dependants.
- Preserves completed independent work such as OCR, translation, verified identity, evidence, and idempotency receipts.
- Freshness gaps refresh retrieval/search branches instead of restarting perception and text extraction.
- Identity and comparison gaps reopen only their dependency branches.
- Blocked/user-input states never auto-replan around missing evidence.
- Unknown future gaps fail closed rather than restarting the whole graph.
- Recovery keeps lifetime execution counters so repeated recovery cannot hide prior cost or bypass graph budgets.
- Reuses Task Graph, receipts, checkpoints, and the existing planner execution boundary; no second planner or orchestrator was added.

## 0.64.6 — Goal Satisfaction / Answerability Closure

- Added an explicit goal-satisfaction assessment after Task Graph execution; graph completion no longer implies that the user's goal was solved.
- Closure distinguishes `satisfied`, `partial`, `unsatisfied`, and `blocked` outcomes.
- Current-information tasks require freshness evidence before they can be marked satisfied.
- Identity-dependent, retrieval, and comparison goals verify that their required branches actually produced usable outcomes.
- Unresolved evidence/source conflicts prevent false success even when a fluent final answer exists.
- Goal-satisfaction state is exposed in execution results/snapshots and audit logs without creating a second Orchestrator or Planner.

## 0.64.5 — Dependency-Aware Capability Planning

- Compound capability sets can now trigger the existing Task Graph even when no domain-specific keyword is present.
- Added a bounded capability-composition plan that expresses prerequisite edges instead of treating capabilities as an unordered checklist.
- OCR/read can proceed from visible evidence without exact product identity; translation waits for extracted text.
- Identity-dependent search waits for verified identity, and comparison waits for the evidence-producing branches it consumes.
- Final synthesis depends on graph leaves rather than every intermediate node.
- Reused the existing Task Graph, runner, Teacher handler, budgets, retries, checkpoints, and Orchestrator; no second planner was introduced.

## 0.64.4 — Capability Composition

- World understanding now preserves multiple active domains instead of forcing all downstream reasoning through one winning label.
- Added a thin capability-composition layer that combines active domains with compound user intents; it is not a second router or orchestrator.
- Universal explanations now expose the composed capability plan for downstream planning and observability.
- Simple requests remain lightweight, while compound requests can express combinations such as food + product + translation + compare + search.
- Expanded Chinese find/purchase intent recognition to cover phrases such as “哪里可以买”.

## 0.64.3 — Universal Next-Action Boundary

- Removed repair-centric next-step planning from the universal explanation path.
- Added a domain-neutral next-action planner that prefers the current domain's evidence request, then resolution evidence, then bounded help/escalation.
- Repair troubleshooting remains available only when the world router explicitly classifies the task as `repair`.
- Kept the legacy `troubleshooting` explanation field as a compatibility alias while adding the clearer `nextActionPlan` field.
- Added regression tests preventing plant, product, and document flows from leaking device repair steps.

## 0.64.2 — Hierarchical & Compound Visual Grounding

- Strengthened same-region compound grounding: spatial and semantic constraints must be supported by the same visual region.
- Added parent-scoped ordinal grounding for phrases such as “左边…第二个”, selecting a unique container first and ordering only its contained child regions.
- Parent and child references remain distinct in multimodal fusion; a parent phrase is not incorrectly collapsed onto the child region.
- Hierarchical grounding uses normalized geometry and containment rather than provider output order.
- Ambiguous parent selection remains unresolved and falls back to the existing evidence-gap / Active Vision path.
- Added regression coverage for contradictory spatial+color evidence, valid compound evidence, parent-scoped ordinal selection, parent/child preservation, and ambiguous parents.

## 0.64.1 — Multimodal Ordinal Grounding Reality

- Added Chinese/English/Spanish ordinal references (`first/second/third`) to speech evidence.
- Ordinal references now ground to visual object regions only when a clear horizontal or vertical ordering exists.
- Grounding uses geometric position, never detector array order.
- Ambiguous 2-D layouts remain unresolved and flow into the existing visual-grounding evidence gap instead of being guessed.
- Multimodal fusion now preserves ordinal grounding alongside symptom and temporal speech evidence.
- Added regression coverage for horizontal order, shuffled detector output, ambiguous layouts, and multilingual ordinal phrases.

## 0.64.0 — Voice Runtime Reality & Recognition Guardrails

- Fixed BCP-47 language matching so `zh-CN`, `es-MX`, and similar regional locales correctly match base-language voice engines.
- Treats explicitly multilingual ASR engines as full language matches instead of penalizing them.
- Context rescoring can still rescue a close ASR alternative, but a context-dominated choice now requires user confirmation instead of silently rewriting speech.
- Failed/timeout voice attempts now retain first-partial latency, improving diagnosis of engines that start quickly but fail before final transcription.
- Added regression coverage for locale routing, multilingual routing, context-dominance safety, and partial-latency preservation.

## 0.63.9 — Active Vision / Next Best Evidence

- Added a bounded next-best-visual-evidence planner for actionable visual gaps.
- Brand/model gaps now request a useful label/nameplate view before expensive Teacher escalation.
- Grounding, anomaly, component, spatial, state, identity, and scene gaps each map to evidence-targeted capture guidance.
- Requests one highest-value capture at a time to reduce user burden and redundant photos.
- Resolution plans now expose a structured visual `evidenceGap` without adding a second Problem Solver or Orchestrator.
- Non-visual/unactionable gaps still escalate normally instead of entering a photo-request loop.

## 0.63.8 — Visual Evidence Ladder & Capability Reality

- Added a bounded visual evidence ladder so confidence cannot substitute for semantic specificity.
- Kept `object_identity` for basic object identification while adding `specific_identity` for explicit brand/model questions.
- DETR remains a basic object-identity provider but now explicitly marks its labels as category-level evidence.
- Brand/model requests remain unresolved unless brand-level or stronger evidence actually exists.
- Added runtime capability-reality evidence and regression coverage for category-vs-brand/model boundaries.

## 0.63.7 — Visual Provider Resource Ownership Audit

- Fixed `PixelColorStateProvider` closing caller-owned drawables after pixel analysis.
- Provider now releases only ImageBitmaps it creates internally from Blob/File input.
- Preserves safe future reuse of prepared drawables across visual providers without hidden lifecycle corruption.
- Added regression coverage for borrowed-vs-owned image resource lifetime.

## 0.63.6 — Vision Prepared Asset & First Useful Audit

- Shared the initial decoded image between Fast Triage and Vision attachment preparation.
- Removed one duplicate upload-time `createImageBitmap()` path in normal web runtime.
- Added early shared-source release and graceful fallback.
- Exposed Fast Triage completion to the UI as first-useful progress.
- Full suite expanded to 679 passing tests.


## 0.63.5 — End-to-End Mainline Compression Audit

- Reused initial perception Problem/Resolution/Visual Plan when no new language exists.
- Recomputed multimodal meaning whenever the user adds new speech/text.
- Replaced stale semantic Observation artifacts instead of accumulating old problem/resolution entries across turns.
- Full suite expanded to 677 passing tests.


## 0.63.4 — Unified Evidence Weight Budget

- Added one bounded composer for Autotune, Lab, Scenario and Outcome ranking evidence.
- Prevented correlated benchmark-derived bonuses from stacking independently.
- Added auditable raw/applied evidence diagnostics.
- Full suite expanded to 670 passing tests.


## 0.63.3 — Outcome Feedback & Experience Validation

- Added strict perception outcome attribution and runtime experience store.
- Added bounded experience validation to Vision/Voice runtime ranking.
- Added explicit ASR confirmation/correction feedback loop.
- Prevented downstream problem/Search/Teacher outcomes from contaminating perception-engine learning.
- Full suite expanded to 665 passing tests.


## 0.63.2 — Scenario-aware Routing

- Added bounded scenario-aware runtime ranking from qualified Lab failure-pattern evidence.
- Added exact-scenario minimum sample, freshness, same-device and comparative-strength guards.
- Full suite expanded to 659 passing tests.


## 0.63.1 — Failure Pattern Learning

- Preserved real-world benchmark conditions/tags in case results.
- Added failure-pattern analyzer and evidence-backed remediation hints.
- Competition now explains recurring failure modes instead of only reporting aggregate scores.
- Full suite expanded to 653 passing tests.


## 0.63.0 — Benchmark-to-Runtime Evidence Loop

- Connected Lab evidence to real Vision/Voice runtime ranking.
- Added canary/promoted/regression runtime evidence adjustments.
- Fixed undersized-corpus promotion bug; minimum is now 12 real cases.
- Added 30-day freshness and minimum-case runtime evidence guards.
- Full suite expanded to 649 passing tests.


## 0.62.9 — Vision + Voice Mainline Audit

- Removed OCR from universal-vision critical path.
- Added primary/support/deferred OCR modes.
- Hardened ASR context rescoring and added uncertainty confirmation gate.
- Full suite expanded to 643 passing tests.


## 0.62.8 — Problem Lifecycle

- Added resolved / paused / closed / reopened problem lifecycle.
- Guided troubleshooting now respects lifecycle holds.
- Recurrence creates a new lifecycle generation and marks old evidence as historical.
- Full suite expanded to 639 passing tests.


## 0.62.7 — Problem State Continuity & Anti-Pollution

- Fixed duplicate photo evidence on text follow-ups.
- Added same/new/ambiguous object continuity policy to Brain Problem State.
- Prevented stale Task Package state from contaminating new user tasks.
- Added semantic attempt deduplication and attempt outcomes.
- Full suite expanded to 633 passing tests.


## 0.62.6 — Real-World E2E Case Pack

- Fixed R3 Safety precedence in Unified Orchestrator.
- Added six real-world E2E regression scenarios.
- Full suite expanded to 626 passing tests.


## 0.62.5 — End-to-End Mainline Audit

- Fixed stale Answerability external-route loops.
- Fixed runtime-error-to-Teacher false escalation.
- Fixed first-useful latency timing.
- Added external-call route budgets and E2E mainline health audit.
- Full suite expanded to 620 passing tests.


## 0.62.4 — Mainline Runtime Integration

- Connected compact Problem State and Answerability to the live runtime decision path.
- Added Brain Mainline decision-stage entry point while preserving Unified Orchestrator as sole final route authority.
- Added weak-phone latency budget and heavy-local-vision deferral.
- Task packages now preserve Problem State and Answerability for external help.
- Full suite expanded to 615 passing tests.


## 0.62.3 — Brain Core Consolidation

- Added Problem State, Answerability and consent-gated visual teacher packaging.
- Full suite expanded to 611 passing tests.


## 0.62.2 — Cross-Turn Object Continuity

- Added evidence-backed object continuity state to multimodal sessions.
- Added cross-turn pronoun/reference resolution with current-visual precedence.
- Added sequential multimodal benchmark and continuity metric.
- Full suite expanded to 606 passing tests.


## 0.62.1 — Real-World Multimodal Stage

- Added real image + user utterance multimodal Pilot cases.
- Added real multimodal runner and corpus coverage audit.
- Added Lab execution/results UI for multimodal grounding.
- Full suite expanded to 602 passing tests.


## 0.62.0 — Voice League Evidence Routing

- Added capability-gated Sherpa-ONNX WASM Chinese/English candidate.
- Added Voice League evidence matrix and evidence-only recommendation logic.
- Stopped automatic ASR expansion: next milestone is real multilingual measurement.
- Full suite expanded to 598 passing tests.


## 0.61.9 — Language-Aware Voice League

- Added Moonshine Base English Lab candidate.
- Added language cohorts and engine eligibility filtering.
- Added per-language Voice League execution and UI rendering.
- Preserved Whisper Tiny as multilingual baseline candidate and WebSpeech as live-only adapter.
- Full suite expanded to 593 passing tests.


## 0.61.8 — Multilingual Local ASR Lab Integration

- Added opt-in Whisper Tiny multilingual prerecorded-audio candidate.
- Added local browser audio decode/resample pipeline.
- Connected real Voice Lab benchmark to the existing scoring and competition chain.
- Full suite expanded to 588 passing tests.


## 0.61.7 — Small VLM Lab Integration

- Added experimental engine catalog and device gating.
- Added opt-in SmolVLM 256M to the real Vision Benchmark.
- Added world-first VLM prompt policy and explicit operator consent.
- Kept the candidate out of production registration and automatic promotion.
- Full suite expanded to 585 passing tests.


## 0.61.6 — Real Engine Benchmark Loop

- Added IndexedDB-backed Benchmark Asset Vault.
- Added real Vision engine competition from Pilot Lab.
- Added visual/voice benchmark scorers and Competition Controller.
- Added baseline comparison and persisted device-level results.
- Kept Voice file benchmark disabled until a real file-capable ASR exists.
- Full suite expanded to 582 passing tests.


## 0.61.5 — Pilot Lab Operator UI

- Exposed Pilot Corpus collection in the web UI.
- Added live corpus/ground-truth status and JSON import/export.
- Added PilotLabController and regression tests.
- Full suite expanded to 578 passing tests.


## 0.61.4 — Pilot Corpus Execution Workflow

- Added Pilot Corpus Builder.
- Added ground-truth audit and asset fingerprinting.
- Added generic real-asset benchmark runner.
- Added baseline comparator.
- Full suite expanded to 575 passing tests.


## 0.61.3 — Real Device Benchmark Foundation

- Added real corpus manifest validation.
- Added benchmark sessions and device profiles.
- Added deterministic held-out validation split.
- Added benchmark report aggregation/export.
- Added starter corpus manifest without fake assets or labels.
- Full suite expanded to 570 passing tests.


## 0.61.2 — VISION LAB + VOICE LAB

- Added perception lab metrics, suites, result store and promotion policy.
- Added world-first benchmark coverage with receipt/document cap.
- Added multimodal grounding benchmark.
- Added experimental SmolVLM, Moonshine-runtime and sherpa-WASM adapters.
- Added canary policy and anti-near-tie behavior.
- Full suite expanded to 566 passing tests.


## 0.61.1 — Perception Engine Evaluation & Integration Layer

- Added perception engine adapter/health/selection/runtime-race foundations.
- Preserved existing VisualProviderExecutor as the visual execution authority.
- Added voice fallback execution with time budgets.
- Added visual-context ASR alternative rescoring.
- Added explicit candidate-engine catalog with no fake installation claims.
- Added engine-integration regression tests.
- Full suite expanded to 555 passing tests.


## 0.61.0 — Universal Perception Engine

- Added Fast Perception Triage.
- Moved receipt/OCR from universal default path to conditional document specialist branch.
- Added device-aware perception budgets.
- Added provider-neutral Perception Engine Registry, Benchmark Arena and Release Gate.
- Added Voice Engine Registry, adaptive routing and performance tracking.
- Improved WebSpeech adapter with alternatives and neutral language defaults.
- Added Universal Perception regression tests and architecture documentation.


## 0.60.2 — Global Context & Region/Locale Resolver

- Added independent global context dimensions for user/question/object/source/jurisdiction.
- Added language/locale/currency/measurement/timezone context.
- Propagated Global Context through TaskPackage and OrchestrationContext.
- Made capability routing region-aware but provider-neutral.
- Removed Mexico-specific currency/locale defaults from universal Core.
- Preserved Mexico-specific capabilities as regional specialist logic.
- Added global-context regression tests.
- Full suite expanded to 537 passing tests.


## 0.60.1 — Search Capability Registry + Retrieval Routing

- Added Search Capability Registry.
- Added Web/Image/Official/Manual/Product/Local/Specialist capability classes.
- Added retrieval capability-needs contract.
- Added capability ranking and bounded fallback.
- Connected Web runtime SEARCH executor to capability selection.
- Preserved Privacy Gate, provenance, Verification and top-level Dispatcher authority.
- Added capability-routing regression tests.
- Full suite expanded to 529 passing tests.


## 0.60.0 — Search Privacy Gate + Source Provenance

- Added Search Privacy Gate and Query Sanitizer.
- Applied privacy minimization to both legacy grounded search and RetrievalPlan search.
- Added optional sensitive-search consent policy.
- Added canonical source provenance at search-evidence ingestion.
- Preserved provenance through verification and Teacher sanitization.
- Explicitly tracks unknown license state and attribution requirement.
- Added over-redaction regression protection.
- Added Search Privacy & Provenance documentation.
- Full regression suite expanded to 522 passing tests.


## 0.59.4 — End-to-End Mainline Consolidation Audit

- Audited the real Web request path for bypasses.
- Removed direct specialist execution from Web UI mainline.
- Added Web runtime capability executor adapter behind Execution Dispatcher.
- Mandatory Verification + Re-entry for automatic external routes.
- Removed manual Orchestrator-authority object construction in UI.
- Prevented SEARCH from secretly calling Teacher.
- Connected RetrievalPlan-driven SEARCH to actual provider execution.
- Fixed verified Teacher/Planner re-entry loops.
- Unified initial route presentation with Unified Orchestrator decision.
- Added architecture anti-bypass tests and MAINLINE_AUDIT.md.
- Full regression suite expanded to 514 passing tests.


## 0.59.3 — Verification Authority Consolidation

- Added Verification Core and VerificationVerdict.
- Non-terminal executor results require verification before re-entry.
- Preserved Claim Judge, Evidence Consensus, Source Quality, Freshness and Safety as detailed specialist checks.
- Added conflict, insufficient-evidence, failure and R3 Safety rejection paths.
- Teacher output without structured claims is accepted only with caveat.
- Added provenance to verification verdicts.
- Full regression suite expanded to 510 passing tests.


## 0.59.2 — Execution Authority Consolidation

- Added ExecutionDispatcher as the only post-route execution gateway.
- Added ResultEnvelope and mandatory verification/re-entry semantics for non-terminal external capability routes.
- Added bounded orchestration transition loop.
- Routed Web SEARCH / PLAN / TEACHER automatic execution through Dispatcher.
- Preserved existing detailed Search, Planner, Teacher, Privacy, Budget, Verification and Safety processes.
- Added 6 execution-authority tests.
- Full regression suite expanded to 503 passing tests.


## 0.59.1 — Orchestration Context + Route Contract + Re-entry

- Preserved detailed specialist stages while centralizing only final routing authority.
- Added OrchestrationContext.
- Added auditable RouteContract with rejected alternatives and next-stage semantics.
- Added re-entry context for SEARCH / PLAN / TEACHER.
- Retrieval completion no longer bypasses orchestration.
- Added explicit conflict-report boundary.
- Added orchestration architecture documentation.
- Full regression suite expanded to 497 passing tests.


## 0.59.0 — Unified Decision & Orchestration Core

- Added the single runtime decision authority: `core/orchestration/unified-orchestrator.js`.
- Established deterministic route precedence: Safety → Clarify → Local → Search → Plan → Teacher → Human/Stop.
- Main Web runtime no longer uses the legacy DecisionEngine as its final router.
- Universal Explainer now receives actual search-capability availability instead of assuming search exists.
- Centralized route presentation labels and Teacher visibility.
- Preserved existing Resolution, Retrieval, Intent, Planner, Teacher and Safety modules as specialist advisers rather than competing final decision makers.
- Marked legacy DecisionEngine as a compatibility adapter.
- Added 7 Unified Orchestrator tests.
- Full regression suite: 491 passing tests.


## 0.58.0 — Knowledge Retrieval & Intelligent Escalation

- Added Knowledge Retrieval Router.
- Added web/image/official/manufacturer/database source planning.
- Added authority/freshness/cross-check requirements.
- Added source-quality evaluation and attributed retrieval answer contract.
- Added provider-agnostic Knowledge Retrieval Coordinator.
- Added post-retrieval escalation ladder.
- Integrated retrieval/escalation planning into Universal Explainer.
- Preserved Safety and Student/Orchestrator principles.
- Added Knowledge Retrieval & Intelligent Escalation Lab.
- Full regression suite expanded to 484 passing tests.


## 0.57.0 — Universal Intent Understanding + Specialist Orchestration

- Added Product Principles with Student/Orchestrator mission.
- Added compound Universal Intent Router.
- Added intent response planning.
- Added Specialist Handoff evidence package and prepared prompt.
- Added explicit attribution and SeeMind/external-specialist role boundaries.
- Added referral presentation.
- Integrated intent + orchestration into Universal Explainer after world understanding and alongside Safety Kernel.
- Added Universal Intent + Orchestration Lab.
- Full regression suite expanded to 472 passing tests.


## 0.56.0 — Real-World Safety Kernel

- Added Safety Constitution.
- Added R0/R1/R2/R3 consequence-aware real-world risk assessment.
- Added R3 protective-only output and dangerous-action filtering.
- Added electrical, fire/gas, poisoning, medical, vehicle, animal and chemical hazard routes.
- Added Safety Audit record.
- Added locked commercial service-category handoff after safety decision.
- Integrated Safety Kernel into Universal Explainer before final action output.
- Added user-visible R2/R3 safety notice.
- Added Real-World Safety Kernel Lab.
- Full regression suite expanded to 460 passing tests.


## 0.55.0 — Universal World Understanding

- Re-centered SeeMind Core on image + voice universal explanation and action.
- Added UniversalWorldRouter with broad domain-neutral routing.
- Moved repair-specific evidence logic behind a specialist repair route.
- Added generalized evidence strategies for plants, animals, food, documents, finance, products, vehicles, places, translation and general objects.
- Added safe-distance animal guidance and contextual vehicle guidance.
- Universal Explainer now exposes world-domain routing.
- Added Universal World Understanding Lab.
- Full regression suite expanded to 447 passing tests.


## 0.54.0 — Cross-Photo Evidence Reasoning

- Added real-world Evidence Graph.
- Added cross-photo same/probably-same/unresolved/new-object resolution.
- Added hard model/serial conflict boundaries.
- Added photo evidence extraction and view typing.
- Added entity summaries combining nameplate, error-code, state and part evidence.
- Integrated Evidence Graph into ProblemSolvingSession and Universal Explain.
- Added user-visible cross-photo relationship guidance.
- Added Cross-Photo Evidence Reasoning Lab.
- Full regression suite expanded to 437 passing tests.


## 0.53.0 — Evidence Request Intelligence

- Added Evidence Gap Analyzer.
- Added prioritized evidence types and Capture Director.
- Added nameplate/model, error-code, indicator, grounding, connection, and damage capture guidance.
- Added redundant-evidence suppression and evidence-progress evaluation.
- Integrated capture requests into Guided Troubleshooting and Universal Explain UI.
- Added safety boundary for hazardous damage close-ups.
- Added Evidence Request Intelligence Lab.
- Full regression suite expanded to 427 passing tests.


## 0.52.0 — Problem Solving Dialogue

- Added persistent ProblemSolvingSession state.
- Added multi-photo and multi-turn evidence accumulation.
- Added user-attempt extraction and duplicate-step avoidance.
- Added guided troubleshooting next-step planner.
- Added resolved/reopened case lifecycle.
- Integrated troubleshooting state into Universal Explainer.
- Preserved case state across “再拍一张”; added explicit “新问题”.
- Added Problem Solving Dialogue Lab.
- Full regression suite expanded to 417 passing tests.


## 0.51.0 — Universal Explain Experience

- Added Universal Explainer composition layer.
- Added immediate first-look explanation for ordinary images.
- Unified first-look and image+voice follow-up explanation paths.
- Preserved dedicated receipt/document structured view.
- Added summary/highlight/next-step user-facing UI.
- Added concise voice narration output.
- Preserved observed/candidate/user-reported evidence boundaries.
- Added safe HTML escaping for explanation content.
- Added Universal Explain Experience Lab.
- Full regression suite expanded to 409 passing tests.


## 0.50.0 — Visual Benchmark & Device Autotuning

- Added browser device profiling and visual execution budgets.
- Added per-device/per-provider/per-capability benchmark history.
- Added load/inference/failure/timeout recording.
- Added benchmark-based preferred/allowed/avoid recommendations.
- Added device-aware provider filtering and ranking.
- Added automatic heavy-model avoidance on low-power devices.
- Integrated autotune budgets with Local Student visual execution.
- Added device suitability to Model Manager UI.
- Added Device Autotuning Lab.
- Full regression suite expanded to 399 passing tests.


## 0.49.0 — Model Manager UI & First-Run Experience

- Added user-facing Model Manager panel.
- Changed heavy General Vision DETR from implicit/default execution to explicit opt-in.
- Added install/progress/retry/ready/offline/delete model states and actions.
- Added storage estimate display and model preference tracking.
- Added ModelManager service and default model catalog.
- Wired verified installed model state to the web visual-provider pool.
- Preserved OCR/speech/barcode/lightweight local operation when the model is absent or fails.
- Added Model Manager First-Run Lab.
- Full regression suite expanded to 390 passing tests.


## 0.48.0 — Model Delivery & Offline Cache

- Added versioned Model Manifest and deterministic cache keys.
- Added model CacheStorage/Memory stores and storage estimates.
- Added SHA-256 integrity verification with corrupt-cache rejection.
- Added download progress, retry, offline-only, storage-budget, removal, and old-version cleanup.
- Added actual-URL model asset cache and Service Worker fetch bridge.
- Added base-path-safe Service Worker registration.
- Added optional delivery gate to the DETR provider.
- Added Model Delivery Lab.
- Full regression suite expanded to 381 passing tests.


## 0.47.0 — First Real General-Vision Student

- Added real Transformers.js DETR object-detection provider.
- Added object identity, confidence, bbox, region evidence, and conservative scene candidates.
- Added per-image detector result cache.
- Added local-model-only configuration path.
- Wired default visual providers into Local Student execution for unknown/general images.
- Propagated General Vision facts into Multimodal/Problem/Explanation layers with candidate-vs-observed boundaries.
- Added First General Vision Student Lab.
- Full regression suite expanded to 371 passing tests.


## 0.46.0 — Visual Provider Runtime & Real Local Model Adapters

- Added provider/model runtime lifecycle manager with load reuse and unload.
- Added provider load/inference timeout isolation and fallback.
- Added real local pixel color/state visual provider.
- Added browser-native BarcodeDetector provider.
- Added generic local model runtime adapter for ONNX/WebGPU/WASM-style sessions.
- Added default real-local visual provider factory.
- Kept absent model assets explicitly unavailable rather than faking general-vision capability.
- Added Visual Runtime Lab.
- Full regression suite expanded to 361 passing tests.


## 0.45.0 — Visual Student Provider Architecture

- Added vendor-neutral VisualProvider contract and registry.
- Added capability/device/privacy/memory-aware provider filtering.
- Added provider ranking using capability fit, reliability/history, latency and memory cost.
- Added per-provider/per-capability performance history.
- Added local execution with provider failure fallback.
- Added unresolved-capability-only Vision Teacher escalation.
- Added Visual Student Provider Architecture Lab.
- Full regression suite expanded to 351 passing tests.


## 0.44.0 — General Vision Student & Visual Capability Router

- Added capability-first visual routing.
- Added General Vision Observation Contract.
- Added Visual Analysis Plan and capability-specific fallback.
- Integrated general-vision regions with Visual-Language Grounding.
- Integrated visual capability plans with Student, multimodal fusion, and Resolution Router.
- Preserved specialized OCR/document routes when sufficient.
- Added minimum-necessary Vision Teacher escalation for missing visual capabilities.
- Added General Vision Router Lab.
- Full regression suite expanded to 341 passing tests.


## 0.43.0 — Explanation & Action Contract

- Added evidence-bounded user explanation contract.
- Separated observed facts, user reports, inference, actions, unknowns, and escalation.
- Added visible confidence labeling.
- Converted evidence requests into concrete user actions.
- Preserved minimum-necessary Teacher/tool escalation.
- Added specialist AI/tool/manual/human-expert fallback guidance.
- Integrated explanation generation into the web voice/text flow before escalation.
- Added Explanation & Action Contract Lab.
- Full regression suite expanded to 331 passing tests.


## 0.42.0 — Visual-Language Grounding

- Added Visual Region Evidence contract with bbox normalization.
- Preserved OCR blocks/bboxes in Student observation.
- Added spatial, code/text, and semantic indicator grounding.
- Added compound spatial + semantic grounding such as “右边红灯”.
- Kept “这里/那里” unresolved without pointing/region evidence.
- Added provider-neutral region interface for future object/scene detectors.
- Integrated grounding into Multimodal Context and unknown tracking.
- Added Visual-Language Grounding Lab.
- Full regression suite expanded to 321 passing tests.


## 0.41.0 — Multimodal Input & Intent Fusion

- Added speech-evidence extraction for symptoms, timing, attempted actions, intent, references, and uncertainty.
- Added image + speech/text + conversation multimodal fusion context.
- Added strict cross-modal evidence boundaries.
- Added unresolved visual-reference tracking for future grounding.
- Added multimodal problem prompt and session contracts.
- Integrated multimodal context into web voice/text question flow and Problem Understanding.
- Added Multimodal Fusion Lab.
- Full regression suite expanded to 311 passing tests.


## 0.40.0 — Problem Understanding & Resolution Router

- Added problem/intent understanding over Student observations.
- Added local/evidence/Teacher-tool resolution decisions.
- Added active visual evidence requests.
- Added minimum-necessary escalation policy.
- Added specialist-tool/manual/human-expert fallback path.
- Added Student problem and resolution observations.
- Added Resolution Router Lab.
- Full regression suite expanded to 301 passing tests.


## 0.39.0 — Universal Structured Facts / 通用事实层

- Added universal Fact Contract and aggregation layer.
- Unified shared and specialized parser output into identity/time/money/parties/banking/fiscal/domain facts.
- Preserved evidence, confidence, provenance, unresolved state, and conflicts.
- Added explicit no-accounting/no-income-expense/no-auto-posting policy boundary.
- Added Student `structured_facts` observation.
- Added Universal Structured Facts Lab.
- Full regression suite expanded to 291 passing tests.


## 0.38.0 — Document Router / Specialized Parsers

- Added confidence-gated specialized Document Router.
- Added Gas Station, CFDI, Bank/SPEI, and Restaurant specialized parsers.
- Added specialized field evidence without allowing specialized parsers to overwrite common receipt totals/tax fields.
- Added Student `specialized_document` observation.
- Added Document Router Lab.
- Full regression suite expanded to 279 passing tests.


## 0.37.0 — Merchant & Receipt-Type Intelligence

- Added deterministic document-type classification for retail, convenience, gas station, restaurant, CFDI, bank transfer, and unknown.
- Added type-specific field expectation policy.
- Added Merchant Identity with distinct brand/legal-entity evidence and relationship.
- Removed slogan/summary false positives from merchant candidates.
- Local Student now exposes classified document type.
- Added Merchant & Receipt-Type Intelligence Lab.
- Full regression suite expanded to 271 passing tests.


## 0.36.0 — Receipt Intelligence v2 / Mexico Receipt Reasoning

- Added receipt amount candidate pool and deterministic relation layer.
- Added candidate-only TOTAL suggestions that never auto-fill missing TOTAL.
- Added evidence-based confidence adjustment without field rewriting.
- Added IVA percentage validation and mixed-evidence handling.
- Expanded full Spanish month date parsing.
- Preserved evidence-gated currency-symbol/leading-5 recovery.
- Added receipt quality and review-needed assessment.
- Expanded Mexican Receipt Golden Suite and added Receipt Intelligence v2 Lab.
- Full regression suite expanded to 260 passing tests.


## 0.35.0 — Portable Corpus Export / Import + Real Image Binding

- Added portable corpus export with package metadata, real image bytes, and archive manifest.
- Added independent per-file SHA-256 archive verification.
- Added strict import rejection for missing, modified, duplicated, or malformed payloads.
- Added safe image rebinding by path or SHA-256.
- Reused v0.34 package verification as a second integrity layer after archive verification.
- Full regression suite expanded to 246 passing tests.


## 0.34.0 — Corpus Package / Real Benchmark Runner

- Added Eligible-only Corpus Package generation.
- Added Ground Truth manifest hash, per-image SHA-256, package hash, and tamper/missing-image verification.
- Added Real OCR Benchmark preflight with explicit `not_executed` state.
- Added verified-package adapter into the existing OCR Benchmark framework.
- Bound real benchmark results to dataset/package hashes and case count.
- Added Real OCR Benchmark Runner Lab using synthetic fixtures only; no real OCR accuracy claim.
- Full regression suite expanded to 237 passing tests.


## 0.33.0 — Corpus Persistence / Batch Annotation Queue

- Added batch receipt selection and annotation queue.
- Added pending/annotation/review/eligible/error/skipped workflow states and filters.
- Added previous/next/skip navigation.
- Added LocalStorage resume for safe queue metadata and Ground Truth drafts.
- Raw receipt image bytes are explicitly excluded from persisted queue snapshots.
- Added queue/persistence/static UI regression tests.
- Full regression suite expanded to 229 passing tests.


## 0.32.0 — Annotation UI / Human Review Console

- Added isolated `annotation.html` human-review console without complicating the main SeeMind UI.
- Added image + core-field review layout for COMERCIO/FECHA/SUBTOTAL/IVA/DESCUENTO/TOTAL/EFECTIVO/CAMBIO.
- Added explicit suggestion acceptance, manual correction, and not-applicable controls.
- Added centavo-safe manual money editing.
- Added consent/redaction confirmation UI and sensitive OCR text warning.
- Added Reviewer reject/approve flow and clean Ground Truth JSON export.
- Added annotation console and static UI regression tests.
- Full regression suite expanded to 219 passing tests.


## 0.31.0 — Real Corpus Intake / Annotation Workflow

- Added Student-assisted Ground Truth draft generation with suggestions isolated from confirmed truth.
- Added annotator field confirmation/correction and annotation progress.
- Added critical-field, consent, and image-redaction gates before review.
- Added Reviewer approve/reject lifecycle and strict benchmark eligibility.
- Strengthened corpus validator to require review + consent + redaction in strict mode.
- Added multi-case intake session and duplicate protection.
- Added Annotation Workflow Lab; score 100.
- Full regression suite expanded to 209 passing tests.


## 0.30.0 — Real Receipt Benchmark Corpus / Ground Truth Tooling

- Added reviewed Ground Truth schema and corpus eligibility rules.
- Added deterministic corpus manifest/hash and tamper verification.
- Added duplicate, field-contract, review-state, and arithmetic consistency validation.
- Added text-side sensitive-data scanning/redaction and explicit image-redaction confirmation boundary.
- Added validated-corpus to OCR-benchmark adapter.
- Added empty private-safe corpus scaffold and Ground Truth template.
- Added Receipt Corpus Lab; synthetic tooling score 100.
- Full regression suite expanded to 199 passing tests.


## 0.29.0 — Real OCR Benchmark / Engine Promotion

- Added OCR benchmark dataset and multi-strategy runner.
- Added field/critical/TOTAL/date accuracy, failure, latency, fallback, and recognition metrics.
- Added grouped and overall OCR strategy rankings.
- Added gated OCR promotion candidate flow requiring regression and explicit approval.
- Added synthetic benchmark lab for framework validation only; no fabricated real Paddle/Tesseract accuracy claims.
- Full regression suite expanded to 190 passing tests.


## 0.28.0 — OCR Engine Health / Adaptive Routing

- Added OCR engine aggregate performance store and privacy-safe LocalStorage persistence.
- Added smoothed success rate for low-sample routing stability.
- Added image-difficulty-aware OCR routing and device-class budgets.
- Added primary-with-fallback early-stop strategy for easy receipts.
- Added dual-engine competition for hard images and strict low-power budgets.
- OCR Ensemble now feeds success/failure/latency/evidence metrics back into routing history.
- Fixed null early-stop semantics so legacy ensemble calls remain unchanged.
- Added 4-case OCR Adaptive Routing Lab; score 100.
- Full regression suite expanded to 182 passing tests.


## 0.27.0 — Real PaddleOCR Integration Boundary

- Added real local PaddleOCR Python service contract with `/health` and `/v1/ocr`.
- Added Gateway Paddle OCR proxy, health state, timeout, and safe failure classification.
- Added browser HTTP Paddle OCR engine.
- Student now uses Paddle-first/Tesseract-fallback when a Gateway is configured.
- OCR Ensemble now tolerates individual engine failure and only fails when every engine fails.
- Confirmed local service reports unavailable when Paddle runtime is absent rather than claiming success.
- Full regression suite expanded to 172 passing tests.


## 0.26.0 — OCR Engine Abstraction / PaddleOCR Ready

- Added provider-neutral OCR Result contract and richer OCR Engine metadata.
- Added OCR Engine Registry with language/capability selection and safe profiles.
- Updated Tesseract to the common contract.
- Added PaddleOCR-ready adapter with injected runtime boundary; no model is bundled or claimed active yet.
- Added cross-engine OCR ensemble selection using existing receipt-evidence scoring.
- Added global OCR recognition budget across engines.
- Preserved legacy single-engine injection compatibility.
- Added 4-case OCR Engine Abstraction Lab; score 100.
- Full regression suite expanded to 166 passing tests.


## 0.25.0 — Multi-Pass OCR Selection

- Added bounded multi-pass OCR over image preprocessing candidates.
- Added receipt-aware OCR scoring using confidence, field completeness, DATE/TOTAL completeness, arithmetic consistency, and normalization cost.
- Student now selects the strongest evidence-bearing OCR pass instead of always using the first preprocessing plan.
- Added compact per-pass audit metadata without duplicating full OCR text for every pass.
- Added 3-case Multi-Pass OCR Selection Lab; score 100.
- Full regression suite expanded to 159 passing tests.


## 0.24.0 — Image Preprocessing Lab

- Replaced fixed one-size-fits-all OCR preprocessing with quality-aware adaptive preprocessing.
- Added brightness, contrast, sharpness/detail, dark clipping, and highlight clipping metrics.
- Added bounded enhancement plan selection with conservative grayscale/contrast/brightness/gamma and light sharpening.
- Preserved original image bytes; preprocessing only emits derived OCR images and metadata.
- Student observations now expose quality metrics and selected/candidate enhancement plans.
- Added 10-case Image Preprocessing Lab; score 100.
- Full regression suite expanded to 153 passing tests.


## 0.23.0 — OCR Normalization / Receipt Recovery Lab

- Added auditable OCR normalization between OCR engine output and Receipt Parser.
- Preserved immutable raw OCR alongside normalized text and recovery transformations.
- Added conservative receipt-label recovery and amount-scoped OCR glyph recovery.
- Added safe non-financial duplicate-line suppression while preserving repeated tax/discount rows.
- Added 12-case OCR Receipt Recovery Lab; score 100.
- Full regression suite expanded to 146 passing tests.


## 0.22.0 — Mexican Receipt Golden Suite

- Added 30-case Mexican Receipt Golden Suite with critical regression cases.
- Fixed multi-IVA handling: all IVA rows are summed instead of taking only the last row.
- Added deterministic discount extraction/summing and discount-aware arithmetic validation.
- Fixed cash parsing so card-payment lines are not treated as `EFECTIVO`.
- Added safe segmentation for OCR-glued receipt summary rows.
- Excluded `TOTAL PARCIAL` from final TOTAL candidates and retained `TOTAL DE ARTÍCULOS` exclusion.
- Hardened merchant candidate filtering against discount/payment summary rows.
- Added standalone `npm run golden:receipt`; current suite result 30/30, score 100.
- Full regression suite expanded to 138 passing tests.


## 0.21.0 — Golden Dataset / Evaluation Lab

- Added versioned Golden Dataset and Golden Case contracts with stable IDs, tags, weights, domains, and critical markers.
- Added Evaluation Lab execution with nested truth comparison, per-domain scoring, and machine-readable failure paths.
- Added baseline-vs-candidate comparison that reports improvements, regressions, and critical regressions.
- Connected Golden regression results to the existing Candidate governance gate; critical regressions block promotion.
- Seeded core Golden cases for Mexican receipts, freshness/search requirements, evidence rejection, identity-before-search, and recovery idempotency.
- Golden Dataset is privacy-safe by default: no automatic ingestion of raw user images, OCR, conversations, API keys, or Teacher answer bodies.
- Regression suite expanded to 136 tests.


## 0.20.0 — Evaluation / Failure Analysis

- Added offline failure classification across perception, entity, router, Teacher output, Search/source, evidence, provider, schema/contract, user-input, budget, and execution layers.
- Planner executions now automatically produce an `EvaluationResult` from the privacy-safe durable audit stream.
- Added `ImprovementCandidate` generation without automatic production mutation.
- Added governance gates: proposed → offline evaluated → regression passed → explicit approval → promoted.
- Critical regression rejects a candidate; direct promotion is forbidden.
- Added safer Planner/Search audit metadata so failure ownership can be diagnosed without storing raw user/AI content.
- Added explicit user-feedback classification support for failures telemetry cannot prove on its own.
- Regression suite expanded to 130 tests.

## 0.19.0 — Durable Event Log / Audit Replay

- Added privacy-safe durable audit event storage for browser sessions.
- Added audit replay that reconstructs Planner steps, Teacher selection reasons, searches, failures, evidence warnings, and final validation decisions.
- Planner execution now emits durable black-box events in addition to checkpoints.
- Teacher routing logs scores/reasons, fallback, latency, validation acceptance/rejection, and errors without storing prompts or answers.
- Search/identity/evidence handlers log safe fingerprints and metadata rather than raw user queries or OCR content.
- Sensitive keys, tokens, raw OCR text, conversation content, answers, prompts, and image Data URLs are redacted or fingerprinted.
- Browser app now uses LocalStorage-backed audit events with in-memory fallback.
- 120 automated regression tests passing.

# Changelog

## 0.17.0

- Added executable Planner Execution Orchestrator and Node Handler Registry.
- Task Graph nodes now invoke real Identity, Search, Teacher, Evidence and Result handlers.
- Added isolated Execution Context and secret-safe execution snapshots.
- Added identity verification / ASK USER behavior at node level.
- Added bounded evidence retrieval inside Search nodes and consensus-aware Evidence nodes.
- Teacher nodes are constrained to execute only the current graph node.
- Web complex-question flow now uses the execution orchestrator while simple questions remain lightweight.
- Preserved mandatory-node stop, optional-node degradation, retry budgets, pause/resume and cancellation.
- Regression suite: 110 tests passing.

## 0.16.0

- Added provider-independent Planner, TaskGraph and TaskNode models.
- Added dependency and cycle validation before execution.
- Added bounded execution budgets for steps, failures, retries and latency.
- Added explicit pause/ask-user, resume and cancellation semantics.
- Mandatory node failures stop the plan; optional nodes may degrade without blocking the final result.
- Added planning templates for troubleshooting, comparison/shopping, manual lookup and research.
- Complex Task Packages now carry safe planning context through privacy sanitizer and Gateway Teacher prompts.
- Web remains minimal and only surfaces “分步处理” rather than internal graph details.
- Regression suite: 103 tests passing.

## 0.15.0

- Added Evidence Retrieval Strategy with task-specific evidence targets.
- Added bounded multi-round Search Escalation with `maxSearches` and explicit stop conditions.
- Price conflicts now seek independent live retailer evidence instead of repeating broad search.
- Legal/regulatory conflicts prioritize government primary sources.
- Manual/compatibility/repair gaps prioritize manufacturer manuals and professional databases.
- Medical/safety retrieval prioritizes official and authoritative guidance.
- Added retrieval metadata to Task Package, privacy sanitizer, Gateway search contract, and Teacher prompt.
- Added independent-source majority conflict resolution with mandatory caveat.
- Search plan now carries safe task context so source-quality ranking remains task-aware through Gateway.
- Gateway search adapter preserves claim/source provenance metadata required by Evidence Brain.
- Regression suite: 90 tests passing.

# SeeMind Changelog

## v0.14.0 — Evidence Consensus / Conflict Resolution

- Added evidence-family detection so syndicated/reposted pages do not count as independent corroboration.
- Added consensus analysis across `claimKey` / `claimValue` evidence.
- Added conflict resolution using task-specific quality, directness, freshness, and independent-source support.
- Clearly superior primary/authoritative evidence may resolve a conflict with an explicit warning/caveat.
- Close high-quality source conflicts remain unresolved and block definitive factual/price claims.
- Added `evidenceConsensus` to the grounded Identity → Search workflow and Teacher context.
- Preserved safe source-family and consensus metadata through privacy sanitization.
- Teacher result validation now distinguishes non-blocking consensus warnings from blocking failures.

# Changelog

## 0.12.0 — Identity → Search → Verify

- Added identity-first workflow for identity-dependent tasks.
- Search is blocked until a reliable Canonical Entity exists.
- Added Teacher `identityProposal` contract with evidence and confidence validation.
- Verified entity can persist in the current conversation session.
- Canonical brand/model/name now anchors search queries.
- Fixed privacy sanitizer so safe Search Evidence provenance (type, URL, timestamps) survives Teacher handoff.
- Added regression coverage for identity-before-search and evidence preservation.

# SeeMind Changelog

## v0.13.0 — Source Quality / Evidence Ranking

- Added task-aware source classification and quality scoring.
- Added source tiers and task-specific minimum quality thresholds.
- Current/fresh factual claims now require both fresh and sufficiently credible Search Evidence.
- Added independent origin/publisher diversity analysis.
- Added explicit source-conflict detection through optional `claimKey` / `claimValue` evidence metadata.
- Preserved source-quality provenance through privacy sanitization.
- Added 9 regression tests; total automated suite now 74 tests.

## v0.11.0 — Entity Identity Brain

- Added canonical Entity model with independent identity confidence/status.
- Added Entity Resolver for Student candidates and deterministic merchant evidence.
- Added candidate merging, competing-identity/brand/model conflict detection, and clarification gating.
- Added stronger identity requirements for price, manual, compatibility, maintenance and troubleshooting tasks.
- Task Package now carries resolved entity context and explicit identity instructions for Teachers.
- Generic labels such as TIENDA/STORE are never promoted into fake identities.
- Identity confidence remains independent from OCR/fact confidence.
- Added 6 Entity Identity regression tests.

## 0.9.0
- Added Student Collaboration Brief with known / uncertain / unknown / limitations / teacherQuestions / focus targets.
- Task Package Compiler now tells Teachers what Student already knows and what actually needs verification.
- Added task-aware Teacher Performance Store for historical success, latency and cost.
- Teacher Router can combine static capability profiles with observed task-specific performance.
- Teacher Orchestrator can record outcomes into the performance store without coupling Core to persistence.
- Gateway Teacher Manager now reports safe aggregate success-rate and latency metrics while keeping upstream error details private.
- Added collaboration/privacy/routing regression coverage; total automated tests now 46.

## 0.6.0
- Added provider-independent Task Package Compiler v2.
- Added secure HTTP Gateway Teacher contract; browser never carries provider API keys.
- Added Answer Contract and claim-level evidence validation.
- Unsupported factual/price/safety claims now fail validation and can trigger Teacher fallback.
- Preserved v0.5 Provider compatibility and privacy/budget controls.

# Changelog

## 0.5.0
- Added rich Teacher capability/profile contract.
- Added explainable multi-factor routing.
- Added provider configuration store with secret-safe public snapshots.
- Added minimum-necessary privacy sanitizer/redaction.
- Added Teacher call/fallback/latency/cost budgets.
- Added bounded automatic fallback and audit events.
- Added infrastructure regression tests.

## 0.4.0
- Added Teacher Registry, Router, Orchestrator and result validation.
- Added consent gate and local Demo Teacher.

## 0.3.0
- Added Vision + Hearing + Speech interaction skeleton and conversation session.

## 0.7.0
- Added runnable Node.js SeeMind Gateway (`npm run gateway`) with `/health`, `/v1/teachers`, and `/v1/teacher/execute`.
- Added logical server-side Teacher A/B/C configuration via environment variables; upstream API keys never enter browser bundles.
- Added first provider-protocol adapter: `openai-compatible`, isolated inside `gateway/providers` rather than Core.
- Added gateway teacher discovery so the web client can connect using `?gateway=http://127.0.0.1:8787`.
- Voice/text questions automatically invoke a configured Teacher after one-time user consent; without a Teacher the app explicitly refuses to pretend it knows.
- Added payload limits, timeout handling, narrow development CORS, safe gateway errors, and server-side public profile redaction.

## 0.8.0
- Added local Vision Attachment preparation for Teacher-bound images: resize, JPEG compression, bounded payload and ephemeral session handling.
- Images are not sent on capture; they are attached only after an explicit per-call Teacher consent.
- Added image-aware privacy sanitizer and gateway-side media validation.
- Vision questions now require both `reasoning` and `vision` capabilities when a prepared image is available.
- Added multimodal image input support to the isolated `openai-compatible` gateway adapter.
- Image attachment IDs can act as evidence references for visually grounded factual claims.
- Added Gateway Teacher Manager with degraded/circuit-open/half-open health states and failure recovery.
- Added per-Teacher health endpoint and health-aware Teacher discovery.
- Expanded automated regression suite to cover Vision privacy, multimodal prompts, visual evidence, capability rejection and circuit breaking.

## 0.10.0
- Added Freshness Engine with STATIC / SLOW_CHANGING / FAST_CHANGING / LIVE classification.
- Added explicit Search Planner; current-world questions no longer rely on Teacher memory.
- Added server-side `/v1/search` Gateway contract with API keys kept off the browser.
- Added timestamped Search Evidence normalization.
- Claim Judge now requires fresh search evidence for time-sensitive factual and price claims.
- Web flow automatically attempts search when freshness is required and clearly degrades when search is unavailable.
- Kept Search and Teacher reasoning as separate capabilities so providers remain replaceable.
- Regression suite: 54 tests passing.

## 0.18.0 — Persistent Task State / Crash Recovery

- Added durable planner execution checkpoints with a provider-independent schema.
- Added LocalStorage and memory task-state stores.
- Running nodes recover as pending after an interrupted session; completed node receipts are replayed without rerunning the handler.
- Added stable per-node idempotency keys propagated to Search and Teacher Gateway requests.
- Gateway caches completed Teacher/Search request IDs for short-term duplicate suppression.
- Added an idempotent Action executor so the same confirmed action is not applied twice.
- Checkpoints exclude provider runtime objects, obvious secret fields, and image media payloads; omitted media must be re-selected after restart when still required.
- Web app detects an unfinished task and offers the existing Teacher action as “继续任务”.
- Added crash-recovery, privacy, node receipt, action idempotency, and Gateway idempotency regression tests.

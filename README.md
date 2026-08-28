# SeeMind

**Current version: v0.63.6**

> 当前阶段：Knowledge Retrieval & Intelligent Escalation。SeeMind 先用自己的视觉/语音/OCR/上下文和已有知识理解问题；本地证据不足时优先检索公开网页、图片、官方资料、制造商资料或专业数据库，交叉验证后再综合解说；只有搜索仍不足、Safety 要求升级，或专业能力明显更合适时，才把未解决子问题交给专业 AI、工具或真人专家。

**See. Understand. Act.**








































































## v0.63.6 — Vision Prepared Asset & First Useful Audit

- Fixed duplicate image decode at the web upload boundary: Fast Triage and Vision attachment preparation now share one decoded image source.
- The shared source is released immediately after both lightweight consumers have drawn from it; Heavy Vision does not keep the full decoded bitmap alive.
- Existing independent decode paths remain as graceful fallback when shared image preparation is unavailable.
- Exposed Fast Triage completion as a real user-visible first-useful progress boundary without inventing semantic conclusions.
- Added runtime evidence `image_source_reuse` for auditability.
- No new model/provider/router/brain was added.
- Added `VISION_PREPARED_ASSET_AUDIT.md`.
- Full regression suite: 679/679 passed.

## v0.63.5 — End-to-End Mainline Compression Audit

- Removed duplicate initial Problem Understanding / Resolution Planning after image perception; initial image-only explanation now reuses the already computed perception result.
- Reuses the existing Visual Plan only when no new speech/text is present; any new user language forces fresh multimodal understanding.
- Fixed stale semantic-state accumulation: current Problem/Resolution/Multimodal/Explanation artifacts now replace older versions in the Observation instead of being appended forever.
- Prevented downstream `findObservation()` calls from accidentally reading an old resolution plan after later user turns.
- Historical attempts/context remain in Problem State and Conversation; current Observation now represents current semantics.
- Safety, Answerability, Orchestrator, Verification and referral stages were deliberately preserved.
- No new model/provider/router was added.
- Added `MAINLINE_COMPRESSION_AUDIT.md`.
- Full regression suite: 677/677 passed.

## v0.63.4 — Unified Evidence Weight Budget

- Audited cumulative runtime ranking weights after Benchmark, Scenario and Outcome learning.
- Fixed evidence inflation: Vision auxiliary positive evidence could previously stack to +0.42 and Voice to +0.34.
- Added one bounded Evidence Weight Budget shared by existing Vision/Voice routers.
- Correlated Autotune + Lab + Scenario signals now share a +0.16 benchmark-family budget instead of rewarding the same benchmark evidence repeatedly.
- Total positive auxiliary evidence is capped at +0.20; negative evidence is bounded at -0.28.
- Router diagnostics expose raw vs applied evidence and whether capping occurred.
- Hard capability/health/privacy/device gates remain authoritative.
- No new model/provider/router was added.
- Added `EVIDENCE_WEIGHT_BUDGET.md`.
- Full regression suite: 670/670 passed.

## v0.63.3 — Outcome Feedback & Experience Validation

- Added strict runtime outcome attribution: perception technical outcomes and explicit ASR confirmations/corrections are separated from downstream problem/Search/Teacher outcomes.
- Added per-device/per-engine/per-scenario runtime outcome store.
- Scenario/runtime ranking can now be weakened by repeated real technical failures or transcript corrections and modestly reinforced by explicit stable confirmations.
- Added evidence guards: 8 technical attempts, 5 explicit quality signals, 30-day freshness.
- Uncertain ASR confirmation/edit flow now produces qualified recognition-quality feedback.
- Vision does not treat an unresolved real-world problem or re-shot image as a semantic Vision failure.
- No new model/provider/router was added.
- Added `OUTCOME_EXPERIENCE_VALIDATION.md`.
- Full regression suite: 665/665 passed.

## v0.63.2 — Scenario-aware Routing

- Connected qualified failure-pattern evidence to the existing Vision and Voice runtime routers.
- Scenario evidence requires promoted, fresh, same-device results and at least 12 cases for that exact scenario.
- Requires meaningful comparative evidence; one engine or a tiny corpus cannot create a scenario winner.
- Scenario strengths do not leak into unrelated scenarios.
- Runtime capability, health, privacy, language and device-budget gates remain authoritative.
- Vision scenario detection now occurs after Fast Triage so current image evidence can be used.
- No new model/provider/router was added.
- Added `SCENARIO_AWARE_ROUTING.md`.
- Full regression suite: 659/659 passed.

## v0.63.1 — Failure Pattern Learning

- Benchmark rows now preserve tags, conditions and scenarios instead of collapsing everything into aggregate score/latency.
- Added evidence-backed Vision/Voice failure-pattern analysis.
- Added bounded remediation hints for routing/tuning; hints cannot auto-retrain or auto-promote engines.
- Competition output now includes `failureAnalysis` and `remediationHints`.
- No new model/provider/router was added.
- Added `FAILURE_PATTERN_LEARNING.md`.
- Full regression suite: 653/653 passed.

## v0.63.0 — Benchmark-to-Runtime Evidence Loop

- Connected qualified Lab results to real Vision and Voice runtime ranking.
- Added bounded canary/promoted/regression ranking adjustments; Lab evidence cannot bypass capability, health, privacy, language, or device-budget gates.
- Fixed a critical promotion bug: the minimum sample requirement no longer shrinks to the current corpus size.
- Production runtime now ignores Lab evidence with fewer than 12 cases or older than 30 days.
- Vision `visual:<providerId>` benchmark identities map back to real runtime provider ids.
- Voice ranking can consume the same qualified evidence only when that engine is actually installed and runtime-capable.
- No new model/provider/router was added.
- Added `BENCHMARK_TO_RUNTIME_LOOP.md`.
- Full regression suite: 649/649 passed.

## v0.62.9 — Vision + Voice Mainline Audit

- Universal images no longer pay full OCR preprocessing/ensemble cost merely because text exists in the frame.
- Added `ocrMode`: primary / support / deferred.
- Universal-vision fast path reserves zero OCR work; document OCR remains a specialist critical path.
- Reduced speech context-rescoring authority so context cannot overpower materially stronger acoustic evidence.
- Low-confidence or near-tied speech alternatives require confirmation instead of silently entering Brain Mainline.
- No new model/provider/router was added.
- Added `VISION_VOICE_MAINLINE_AUDIT.md`.
- Full regression suite: 643/643 passed.

## v0.62.8 — Problem Lifecycle

- Added explicit problem lifecycle: investigating, resolved, paused, closed, and reopened generations.
- Resolved/paused/closed problems no longer keep generating troubleshooting steps.
- A recurring problem reopens as a new generation; old evidence becomes historical rather than current truth.
- Previous attempts remain useful history after recurrence.
- Added pause/resume/close semantics without creating another state engine.
- No new model/provider/router was added.
- Added `PROBLEM_LIFECYCLE.md`.
- Full regression suite: 639/639 passed.

## v0.62.7 — Problem State Continuity & Anti-Pollution

- Prevented the same observation from being counted as a new photo on every follow-up turn.
- Added continuity-aware Brain Problem State: preserve same-object state, reset object-specific state for a new object, and quarantine ambiguous cross-photo evidence.
- Prevented stale prior-turn Task Package Search/Teacher state from influencing a newly created task.
- Upgraded troubleshooting from sentence-level repeat detection to semantic action ids.
- Added failed/successful attempt outcomes to working Problem State.
- No new model/provider/router was added.
- Added `PROBLEM_STATE_CONTINUITY.md`.
- Full regression suite: 633/633 passed.

## v0.62.6 — Real-World E2E Case Pack

- Fixed a critical orchestration-order defect: `R3` Safety now has absolute precedence over Answerability, Search, Teacher and Plan.
- Added real-world mainline cases for offline Search, failed retrieval, Teacher re-entry and source conflict.
- No new model/provider/router was added.
- Full regression suite: 626/626 passed.

## v0.62.5 — End-to-End Mainline Audit

- Fixed stale Answerability re-triggering SEARCH/TEACHER after verified external re-entry.
- Local image runtime errors no longer masquerade as `TEACHER` routing decisions.
- Corrected `firstUsefulAt` to measure Fast Triage completion instead of post-OCR completion.
- Added hard external-call budgets: max 3 external calls and max 2 repetitions of one route per Web flow.
- Added `Mainline E2E Audit` for duplicate external work, route-budget exhaustion, verification boundary violations, latency regressions and route stagnation.
- Approved flows now write compact E2E audit records to the durable audit log.
- No new models/providers/routers were added.
- Added `END_TO_END_MAINLINE_AUDIT.md`.
- Full regression suite: 620/620 passed.

## v0.62.4 — Mainline Runtime Integration

- Runtime web decisions now pass through one Brain Mainline: Problem State -> Answerability -> Unified Orchestrator.
- Fixed a real v0.62.3 integration gap where these modules existed but the live web path could bypass them.
- Answerability CLARIFY / SEARCH / TEACHER assessments are explicitly arbitrated by the Unified Orchestrator instead of silently falling through.
- Teacher/Search task packages carry compact Problem State and Answerability so external help does not restart from zero.
- Added weak-phone runtime latency budgets and explicit deferral of heavy local vision when fast-path deadlines would be exceeded.
- No new ASR, VLM, teacher, search provider, agent, or router.
- Added `MAINLINE_RUNTIME_INTEGRATION.md`.
- Full regression suite: 615/615 passed.

## v0.62.3 — Brain Core Consolidation

- Added compact Problem State and Answerability stages to the one-brain chain.
- Unified Orchestrator remains the only final routing authority.
- Added consent-gated, minimum-necessary visual teacher packaging for weak local devices.
- Added no new model/provider/router.
- Full regression suite: 611/611 passed.

## v0.62.2 — Cross-Turn Object Continuity

- Added bounded real-world entity continuity to multimodal sessions.
- Follow-up references such as 它 / 这个 / 刚才那个 / it / this one / éste can resolve to the previously grounded object.
- Current explicit visual grounding always takes precedence over stale conversation context.
- Conversation continuity cannot invent a new visual fact; without a prior grounded entity it remains unresolved.
- Multimodal Fusion now accepts evidence-backed conversation references and exposes them to downstream problem understanding.
- Added a sequential multimodal benchmark that preserves one session across turns and measures continuity success.
- Multimodal sessions move to schema v2 while retaining the existing turns/visual/context interfaces.
- Added `CROSS_TURN_OBJECT_CONTINUITY.md`.
- Full regression suite: 606/606 passed.

## v0.62.1 — Real-World Multimodal Stage

- Pilot multimodal cases now preserve the actual user utterance with the real image instead of storing only expected labels.
- Added a true Multimodal Benchmark path: real image -> current visual observation -> speech evidence -> visual-language grounding -> intent -> ground-truth scoring.
- Added a Real-World Corpus audit for reference/problem/follow-up/language/noise coverage.
- Added a Pilot Lab control to run the real multimodal corpus and show grounding quality, success, p50 and p95.
- Fixed benchmark reference scoring so spatial deictic phrases remain distinct from semantic phrases.
- No new ASR/VLM/teacher was added; this release strengthens SeeMind's own coordination layer.
- Added `REAL_WORLD_MULTIMODAL_STAGE.md`.
- Full regression suite: 602/602 passed.

## v0.62.0 — Voice League Evidence Routing

- Added a capability-gated Sherpa-ONNX WASM adapter for Chinese/English Lab competition.
- Sherpa remains disabled unless the host actually supplies a compatible WASM runtime/model; no fake installation or guessed download URL.
- Voice League now has three distinct experimental routes: multilingual Whisper, English Moonshine, and Chinese/English Sherpa.
- Added per-language evidence matrices with case count, quality, success, p50/p95 latency and baseline verdict.
- Added evidence-only cohort recommendations: quality first, then success, then latency when quality is close.
- Recommendations do not change production routing.
- Development policy now explicitly pauses ASR collection and moves to real multilingual corpus measurement.
- Added `VOICE_LEAGUE_EVIDENCE_ROUTING.md`.
- Full regression suite: 598/598 passed.

## v0.61.9 — Language-Aware Voice League

- Added Moonshine Base as a second experimental ASR route for English low-latency competition.
- Moonshine is explicitly English-only in the Lab catalog and refuses Chinese/Spanish instead of pretending multilingual coverage.
- Added language-family Voice League cohorts so engines only compete on languages they actually support.
- English cases can compare Whisper Tiny vs Moonshine; Spanish/Chinese remain on multilingual-capable engines.
- Added language-aware engine eligibility and per-language benchmark rounds.
- Pilot Lab now exposes a separate opt-in Moonshine checkbox with explicit download/memory confirmation.
- Voice League results are rendered per language cohort and persisted through the existing benchmark result store.
- WebSpeech remains the live microphone adapter and is not mixed into prerecorded-file benchmarks.
- Added `VOICE_LEAGUE_ARCHITECTURE.md`.
- Full regression suite: 593/593 passed.

## v0.61.8 — Multilingual Local ASR Enters Voice Lab

- Added the first real prerecorded-audio ASR candidate: Whisper Tiny Multilingual via Transformers.js.
- Added browser audio decoding, stereo-to-mono mixing and 16 kHz resampling.
- Added explicit Voice Lab opt-in and download/memory confirmation.
- Kept WebSpeech as the live microphone recognizer; the experimental ASR is Lab-only and disposed after testing.
- Added device-tier gating and zh/es/en multilingual metadata.
- Voice cases now run through the same real-asset Benchmark Runner, WER/quality scorer, latency metrics, baseline comparison and persisted device results.
- Moonshine/sherpa-onnx remain future candidates; they must beat the multilingual baseline in the same corpus rather than being assumed superior.
- Added `LOCAL_ASR_LAB_INTEGRATION.md`.
- Full regression suite: 588/588 passed.

## v0.61.7 — Small VLM Enters the Real Vision Race

- Added an explicit experimental-engine catalog rather than hard-wiring a new model into production.
- Added SmolVLM 256M as the first opt-in Small VLM candidate.
- Added device-tier gating: constrained/low-power devices do not offer this candidate by default.
- Pilot Lab now has an explicit SmolVLM checkbox and a second download/memory confirmation before loading.
- SmolVLM runs through the same real-asset Competition Controller as the current SeeMind vision baseline and installed visual providers.
- Added a world-first VLM benchmark prompt that prohibits unsupported guessing.
- Benchmark Runner now passes the full benchmark case into engine options so VLM prompts can remain task/category aware.
- Experimental adapters are disposed after the Lab race and are not registered into the production visual path.
- Voice file Benchmark remains honestly unavailable until a file-capable ASR exists.
- Added `SMALL_VLM_LAB_INTEGRATION.md`.
- Full regression suite: 585/585 passed.

## v0.61.6 — Real Engine Benchmark Loop

- Pilot Lab now stores the actual selected benchmark image/audio bytes in a local IndexedDB-backed Asset Vault instead of only filenames.
- Added stable `vault:` corpus references and asset cleanup when a case is removed.
- Added a real Vision Benchmark button.
- The same real corpus cases now run through the current SeeMind visual baseline and every currently installed object/scene visual provider.
- Added semantic visual scoring and voice-file scoring.
- Added engine-neutral Competition Controller with per-engine sessions, baseline comparison and promotion evidence.
- Added persisted device-specific benchmark results that remain visible after reload.
- Voice Benchmark is deliberately disabled until a registered engine can transcribe prerecorded audio; WebSpeech is not misrepresented as such an engine.
- Added `REAL_ENGINE_BENCHMARK_LOOP.md`.
- Full regression suite: 582/582 passed.

## v0.61.5 — Pilot Lab Operator UI

- Added a visible `感知实验室` entry beside the visual model manager.
- Added operator controls for vision, voice and multimodal corpus cases.
- Added live progress toward 30 vision / 20 voice / 10 multimodal Pilot targets.
- Added live Ground Truth and world-coverage warnings.
- Added JSON corpus import/export and case removal.
- Added `PilotLabController` so UI logic remains separate from corpus/benchmark core.
- The UI remains a collection/control surface and does not fabricate benchmark execution.
- Added `PILOT_LAB_UI.md`.
- Full regression suite: 578/578 passed.

## v0.61.4 — Pilot Corpus Execution Workflow

- Added a Pilot Corpus Builder with explicit 30 vision / 20 voice / 10 multimodal readiness targets.
- Added world-category validation for collected visual cases.
- Added ground-truth auditing so empty labels, transcripts or multimodal targets cannot silently enter promotion evidence.
- Added stable asset fingerprinting to help detect renamed/duplicate benchmark media.
- Added an engine-neutral Benchmark Runner that resolves real assets, times each case, scores through task-specific evaluators and continues after individual failures.
- Added baseline comparison across quality, success rate, p50 and p95 latency.
- Added `PILOT_CORPUS_WORKFLOW.md`.
- No fabricated benchmark wins or media were added.
- Full regression suite: 575/575 passed.

## v0.61.3 — Real Device Benchmark Foundation

- Added a versioned real benchmark corpus manifest contract.
- Added per-engine/per-device Benchmark Sessions preserving individual case results.
- Added device benchmark profile collection for platform, mobile/desktop, cores, memory hints, WebGPU and WASM.
- Added deterministic development/held-out corpus splitting so model tuning does not contaminate promotion validation.
- Added benchmark report aggregation and JSON export.
- Added a starter corpus manifest with explicit placeholders rather than fabricated images/audio/ground truth.
- Added corpus guidance for 120–200 vision images, 80–150 voice clips and 40–80 multimodal pairs.
- World-first/receipt-minority benchmark rules remain unchanged.
- Added `REAL_DEVICE_BENCHMARK.md`.
- Full regression suite: 570/570 passed.

## v0.61.2 — VISION LAB + VOICE LAB

- Added a formal perception benchmark suite for real engine competition.
- Added WER, semantic visual quality, intent accuracy and latency metrics.
- Added engine promotion policy requiring sufficient cases, Release Gate success and no material regression.
- Added canary selection policy that refuses near-ties instead of inventing a winner.
- Added persistent Lab result storage.
- Added a world-first visual benchmark blueprint; documents/receipts are capped at 15% and weighted at 8%.
- Added multimodal grounding metrics emphasizing speech reference → image target understanding.
- Added an experimental SmolVLM-256M adapter using an injectable Transformers.js-style image-text-to-text runtime; it is not auto-enabled.
- Added experimental Moonshine and sherpa-onnx WASM runtime adapters; neither bundles models nor claims availability.
- Candidate engines remain lab-only until target-device benchmarks pass.
- Added `PERCEPTION_LAB_ARCHITECTURE.md`.
- Full regression suite: 566/566 passed.

## v0.61.1 — Perception Engine Evaluation & Integration Layer

- Added provider-neutral Perception Engine Adapter contract.
- Added engine Health / circuit-breaker state.
- Added benchmark-aware engine selection.
- Added bounded perception race with timeout/fallback for future cross-modal engines.
- Preserved the existing VisualProviderExecutor as the real visual execution authority instead of creating a competing second visual runtime.
- Added a bridge so existing visual providers can participate in the cross-modal perception catalog/benchmark view.
- Added an explicit candidate-engine catalog; FastVLM, SmolVLM, MobileCLIP/embedding, Moonshine, sherpa-onnx and whisper.cpp remain candidates unless real adapters are installed.
- Added bounded Voice Recognition execution with primary/fallback engines, per-engine timeout and total latency budget.
- Added visual-context ASR rescoring: visible brands/models/labels can rerank speech alternatives.
- WebSpeech now returns final alternatives for contextual rescoring.
- Added regression tests for fallback, circuit breaker, candidate truthfulness, context rescoring and visual-provider bridging.
- Full regression suite: 555/555 passed.

## v0.61.0 — Universal Perception Engine

- Reordered the product mainline around universal image + voice understanding rather than receipt-first processing.
- Added a cheap Fast Perception Triage before expensive OCR preprocessing.
- Natural images no longer pay the full multi-candidate receipt/OCR cost by default.
- OCR and receipt parsing remain intact as a specialist document branch.
- Added device-aware Perception Budgets with first-useful-understanding and bounded local-work targets.
- Added provider-neutral Perception Engine Registry for future VLM/embedding/specialist engines.
- Added Perception Benchmark Arena with p50/p95 latency, reliability and quality tracking.
- Added a Perception Release Gate: smarter-but-too-slow engines fail promotion.
- Added provider-neutral Voice Engine Registry and adaptive router.
- WebSpeech is now explicitly an adapter, supports multiple alternatives, neutral language defaults, and partial/final latency measurement.
- Added Voice Performance Store for future engine competition.
- No FastVLM, SmolVLM, Moonshine, sherpa-onnx or Whisper binary is falsely advertised as integrated; they remain candidate adapters for later measured integration.
- Added `UNIVERSAL_PERCEPTION_ARCHITECTURE.md`.
- Full regression suite: 546/546 passed.

## v0.60.2 — Global Context & Region/Locale Resolver

- Added Global Context with independent user, question, object, source and jurisdiction regions.
- User location is no longer treated as the country governing every problem.
- Added language, document language, locale, currency, measurement-system and timezone context.
- Browser locale/timezone are explicitly treated as hints rather than jurisdiction proof.
- Added neutral Locale Profile registry for replaceable regional defaults/data packs.
- Task, TaskPackage and OrchestrationContext now preserve Global Context through the mainline.
- Search Capability Registry can rank region-compatible providers without hardcoding a provider-country pair.
- Search requests receive relevant language/locale/target-region context.
- Removed MXN from Universal Facts core default; unresolved currency is `XXX-minor`.
- Removed `es-MX` as OCR normalization default.
- Neutralized Spanish/English OCR provider defaults to `auto`; explicit language selection remains available.
- Web speech and money formatting now follow resolved/runtime context rather than fixed `zh-CN` / `es-MX` / `MXN`.
- Mexico-specific parsers and tests remain as regional capabilities; they are not deleted.
- Added `GLOBAL_CONTEXT_ARCHITECTURE.md`.
- Full regression suite: 537/537 passed.

## v0.60.1 — Search Capability Registry + Retrieval Routing

- Added a Search Capability Registry so `SEARCH` is no longer treated as one generic instrument.
- Added capability classes for Web, Image, Official Source, Manual/Documentation, Product/Model, Maps/Local and Specialist Database retrieval.
- Knowledge Retrieval now declares capability needs in addition to source preferences.
- Registry ranks only actually available providers and returns a primary capability plus bounded fallbacks.
- Authority-heavy tasks prefer Official/Manual/Specialist sources when those providers exist.
- Visual-identification tasks prefer Image Search when available.
- Place/find tasks prefer Maps/Local when available.
- Product/manual tasks prefer Manual/Documentation over generic Web search.
- Specialized provider failures can fall back to Registry-approved alternatives with attempt history.
- Both specialized and generic retrieval still pass the v0.60.0 Search Privacy Gate and Query Sanitizer.
- Source Provenance and Verification remain downstream acceptance requirements.
- No fake capabilities are advertised: unimplemented providers remain unavailable.
- Added `SEARCH_CAPABILITY_ARCHITECTURE.md`.
- Full regression suite: 529/529 passed.

## v0.60.0 — Search Privacy Gate + Source Provenance

This release makes external knowledge retrieval safer and auditable before adding a real default search provider.

- Added Search Privacy Gate for all external Web-search paths.
- Added Query Sanitizer for email, phone, bank/card/account-like numbers, CLABE, RFC, CURP, IP addresses and long reference identifiers.
- Search queries follow a minimum-necessary policy; raw OCR is never sent merely because it was available internally.
- Added an explicit external-search policy that can require consent for sensitive searches.
- Legacy grounded search and RetrievalPlan-driven search now share the same privacy-safe provider boundary.
- Fixed an over-redaction regression so long normal words such as `identification` are not mistaken for sensitive reference numbers.
- Added canonical Source Provenance to search evidence.
- Provenance records source ID, URL/host, publisher, source type, publish/access time, retrieval channel, query fingerprint, request ID, upstream/canonical source, license metadata, attribution requirement and cache policy.
- Unknown source licenses remain explicitly unknown rather than being treated as commercially reusable.
- Verification Core now carries canonical provenance forward in its verdict.
- Teacher package sanitization preserves safe provenance metadata.
- Added `SEARCH_PRIVACY_AND_PROVENANCE.md`.
- Full regression suite: 522/522 passed.

## v0.59.4 — End-to-End Mainline Consolidation Audit

This release audits and repairs the real Web runtime path instead of adding another Core module.

- Web UI no longer directly executes Teacher, grounded Search, Planner, or manual re-entry logic.
- Specialist implementations moved behind a Web runtime executor adapter registered with Execution Dispatcher.
- Teacher/Planner executors return candidate results only; they no longer directly write final answers to the conversation.
- Web automatic routes now use `runOrchestrationLoop()` with mandatory Verification Core.
- Explicit user Teacher requests receive an authorized Route Contract through Unified Orchestrator rather than UI-crafted authority.
- SEARCH cannot secretly call Teacher for identity.
- RetrievalPlan-driven SEARCH now actually executes approved queries even when the older compiled TaskPackage does not mark search as required.
- Accepted Teacher/Planner results must re-enter Unified Orchestrator before presentation.
- Initial route UI now follows the final Unified route rather than advisory Resolution output.
- Added `MAINLINE_AUDIT.md` and regression guards against architecture bypasses.
- Full regression suite: 514/514 passed.

## v0.59.3 — Verification Authority Consolidation

This release consolidates result acceptance without removing detailed verification stages.

- Added `Verification Core` as the single acceptance authority for non-terminal executor results.
- Added auditable `VerificationVerdict`.
- Existing Claim Judge, Evidence Consensus and Source Quality modules remain specialist verifiers.
- Execution completion no longer implies trust.
- SEARCH / PLAN / TEACHER cannot re-enter orchestration without a verifier.
- Failed execution is rejected.
- R3 Safety can block external output from authorizing hazardous action.
- Search without qualified evidence returns `NEED_MORE_EVIDENCE`.
- Independent high-quality source conflicts return `CONFLICT` instead of being silently averaged.
- Structured claims are checked against allowed evidence, freshness and source quality.
- Teacher output without structured claims is explicitly only `ACCEPT_WITH_CAVEAT`.
- Provenance is preserved in the verdict.
- Full regression suite: 510/510 passed.

## v0.59.2 — Execution Authority Consolidation

This release centralizes execution authority without collapsing specialist processes.

- Added `ExecutionDispatcher`, the only runtime gateway allowed to execute a Unified Orchestrator Route Contract.
- Added immutable `ResultEnvelope` for LOCAL / SEARCH / PLAN / TEACHER / HUMAN / STOP execution results.
- Unauthorized or manually fabricated route objects are rejected unless they carry Unified Orchestrator authority.
- SEARCH / PLAN / TEACHER remain specialist processes; Dispatcher invokes them but does not replace their internal steps.
- Non-terminal routes are marked `requiresVerification` and must re-enter the Orchestrator before a final route is accepted.
- Added bounded orchestration loop support with `maxTransitions` to prevent unbounded agent loops.
- Web automatic routing no longer directly calls Teacher based only on a UI `if(route)` branch; it passes SEARCH / PLAN / TEACHER through the Dispatcher.
- Search execution continues to use the existing grounded identity -> search -> evidence consensus process.
- Teacher/Planner execution continues to use the existing consent, privacy, budget, provider ranking, result validation, checkpoint and evaluation paths.
- Manual “问老师” is treated as an explicit user route request, but still executes through the Dispatcher.
- Full regression suite: 503/503 passed.

## v0.59.1 — Orchestration Context + Route Contract + Re-entry

This consolidation release preserves the detailed process while centralizing authority.

- Added `OrchestrationContext`, preserving perception, understanding, evidence, retrieval, planning, safety, privacy, budget, capabilities, and execution history as separate stage outputs.
- Added `RouteContract`: every final route now records reason, relevant input snapshot, rejected alternatives, next stage, terminal/non-terminal status, and whether re-entry is mandatory.
- SEARCH, PLAN and TEACHER are explicitly non-terminal routes.
- Added re-entry context so retrieval/planner/Teacher results can return to the same Unified Orchestrator instead of bypassing verification.
- Completed retrieval is treated as evidence, not automatically as a final answer.
- Consistent verified retrieval may return to local synthesis; complex diagnosis/compare/evaluate/solve intents may still hand verified evidence to a specialist for synthesis.
- Conflicting retrieval that reaches a report boundary is surfaced as disagreement rather than silently averaged.
- Added `ORCHESTRATION_ARCHITECTURE.md` documenting the full detailed pipeline and authority boundaries.
- Full regression suite: 497/497 passed.

## v0.59 — Unified Decision & Orchestration Core

v0.59 is a consolidation release, not another new-brain release.

### Single decision authority
All specialist modules remain responsible for analysis only:
- Perception / Vision / OCR observe.
- Entity / World / Intent / Problem modules interpret.
- Resolution proposes what is locally possible and what evidence is missing.
- Retrieval proposes whether public knowledge can reduce uncertainty.
- Planner decomposes complex work.
- Teacher Router ranks external AI specialists.
- Safety Kernel sets non-negotiable risk constraints.
- **Unified Orchestrator alone decides the next runtime route.**

### Route precedence
`Safety → Clarify/Evidence → Local → Retrieval → Planner → Teacher → Human/Bounded Stop`

This prevents the previous anti-pattern where UI code, legacy DecisionEngine, ResolutionRouter, RetrievalRouter and Planner could independently behave like final decision makers.

### Runtime routes
- `LOCAL` — explain from current evidence.
- `CLARIFY` — ask for the single most useful missing evidence before spending external capability.
- `SEARCH` — retrieve public/current/authoritative knowledge before calling a Teacher when retrieval is the right tool.
- `PLAN` — use a bounded Task Graph for genuinely multi-step work.
- `TEACHER` — delegate only the unresolved specialist subproblem.
- `HUMAN` — safety/professional handoff when appropriate.
- `STOP` — state the evidence/capability boundary instead of bluffing.

### Routing authority
Legacy `core/decision/decision-engine.js` has been removed. `Unified Orchestrator` is the only final runtime routing authority.

### Verification
- Unified Orchestrator lab: 7/7 passed.
- Full regression suite: 491/491 passed.

## v0.58 — Knowledge Retrieval & Intelligent Escalation

v0.58 formalizes SeeMind's escalation ladder: understand locally, retrieve public knowledge when useful, answer with sources when retrieval is sufficient, and only then escalate unresolved specialist work.

### v0.58.0 implemented
- Added `KnowledgeRetrievalRouter`.
- Local high-confidence, non-fresh, non-authority-sensitive questions can stay fully local.
- Low-confidence identification can request both web search and image search rather than immediately calling a Teacher.
- Freshness-sensitive intents such as FIND / current availability / price route to current web retrieval.
- Authority-sensitive or R2 decisions request stronger sources and cross-checking.
- Source preferences can include official sources, authoritative databases, current web, image search, manufacturer/manual, maps/local sources, specialist databases, search engines, and reputable web.
- Added retrieval query construction from the user's question + OCR text + top visual identity.
- Added source normalization and quality scoring using authority, relevance, and freshness.
- Retrieval results are not treated as reliable merely because a search snippet exists; plans can require multiple sources and domain diversity/cross-checking.
- Added `KnowledgeRetrievalCoordinator` that executes a provider-agnostic search function, deduplicates results, evaluates source quality, and produces an attributed answer contract.
- Added explicit answer policy: synthesize, attribute sources, separate fact from inference, preserve uncertainty, and never treat raw snippets as verified facts.
- Added escalation decisions after retrieval: `local`, `retrieved_answer`, `specialist_or_tool`, `specialist_or_human`, or `local_or_clarify`.
- R3 Safety overrides ordinary retrieval as a final action authority and routes onward appropriately.
- When public sources are sufficient, SeeMind does not manufacture a specialist referral.
- When retrieval is insufficient, SeeMind escalates rather than bluffing.
- Universal Explainer now exposes `retrievalPlan` and `escalationPlan`.
- Added `npm run lab:retrieval`; 5/5 checks passed, score 100.
- Full regression suite: 484/484 passed.

## v0.57 — Universal Intent Understanding + Specialist Orchestration

v0.57 adds a domain-neutral intent layer and formalizes SeeMind's Student/Orchestrator role.

### v0.57.0 implemented
- Added `PRODUCT_PRINCIPLES.md`: “Do not replace specialists. Orchestrate them.”
- Added Universal Intent Router covering identify, explain, read, translate, understand, how-to-use, how-to-do, diagnose, solve, compare, evaluate, safety, authenticity, find, learn, record, route-to-specialist, and unknown.
- Supports compound intent rather than forcing a single label, e.g. identify + safety + solve.
- Added intent-aware response planning and explicit external-routing signals for FIND and ROUTE_TO_SPECIALIST.
- Added Specialist Handoff packages with original question, structured facts, extracted text, minimum-necessary evidence policy, optional original-image flag, and a prepared specialist prompt.
- Specialist handoffs explicitly label SeeMind as `orchestrator` and the external provider as `analysis_or_execution`.
- Added attribution requirement so SeeMind does not claim external AI/tool/expert work as its own.
- Added referral presentation explaining why the task is being handed onward and what to send.
- Safety escalation can independently trigger a specialist handoff.
- Normal low-risk questions do not manufacture a referral.
- Universal Explainer now exposes `intentGraph`, `intentPlan`, `specialistHandoff`, and `referral`.
- Added `npm run lab:intent`; 6/6 checks passed, score 100.
- Full regression suite: 472/472 passed.

## v0.56 — Real-World Safety Kernel

v0.56 adds a system-level safety gate between reasoning and real-world action output. It does not turn SeeMind away from solving problems; it makes consequence-aware escalation part of solving them.

### v0.56.0 implemented
- Added `SAFETY_CONSTITUTION.md` with non-negotiable mission, Never Bluff, consequence-aware action, protective-first R3, escalation-as-solution, commercial independence, decision-lock, auditability, and domain-neutral safety principles.
- Added `RealWorldSafetyKernel` with R0/R1/R2/R3 action-risk levels.
- R0 permits normal explanation and safe evidence gathering.
- R1 permits ordinary guidance with contextual cautions.
- R2 restricts output to cautious/non-invasive guidance and exposes uncertainty for materially consequential decisions.
- R3 restricts output to protective actions and appropriate escalation; dangerous irreversible instructions are filtered.
- Added serious hazard detection for electrical exposure, fire/gas, poisoning/ingestion, medical emergency signals, vehicle immediate-safety conditions, dangerous animals, and hazardous chemical mixing.
- Added action filtering for dangerous R3 instructions such as touching/cutting electrical parts, bypassing safety, unsafe driving, ingestion, dosing, or chemical mixing.
- Universal Explainer now always produces a safety decision before final next-step output.
- Added user-visible R2/R3 Safety Notice.
- Added compact Safety Audit records containing risk level, reasons, hazards, blocked-action count, escalation category, and allowed instruction level without storing the full raw observation graph in the audit record.
- Added `CommercialHandoff` only after safety escalation has been independently decided and locked.
- Commercial handoff explicitly states that sponsored ranking may not change the upstream safety decision.
- Low-risk cases do not manufacture a professional-service handoff.
- Added `npm run lab:safety`; 5/5 checks passed, score 100.
- Full regression suite: 460/460 passed.

## v0.55 — Universal World Understanding

v0.55 deliberately re-centers SeeMind on its product mission: explain the world from image + voice, then help the user understand, decide, and act. Repair remains supported, but only as one specialist route.

### v0.55.0 implemented
- Added `UniversalWorldRouter` with domain-neutral routing across general, document, product, food, plant, animal, vehicle, place, nature, finance, translation, repair, safety, and unknown.
- Repair is no longer the default evidence policy; it activates only when explicit repair/troubleshooting signals are present.
- General evidence requests are now domain-specific: whole document/page continuation, transaction evidence, food ingredients/date, plant overview/leaf front-back, animal safe-distance features, vehicle context/detail, product front/label/barcode, place context, readable translation text, and generic overview/detail.
- Plant problems can request leaf front/back evidence instead of device model/nameplate.
- Food questions can request ingredients, nutrition and expiry/date regions.
- Animal/insect identification preserves safe-distance guidance and explicitly avoids encouraging touching or approaching unknown animals.
- Document understanding asks for complete pages and continuation pages rather than repair evidence.
- Translation asks for readable source text.
- Vehicle questions request contextual views without automatically entering repair mode.
- Product questions can request packaging labels/barcodes to identify a specific version.
- Finance/document routes preserve the existing OCR/receipt foundation while using neutral evidence goals.
- Existing repair-specific nameplate/error-code/indicator/connection logic remains available behind the repair specialist route, preserving prior functionality.
- Universal Explainer now exposes `worldDomain` and uses broader language: what it is, what it means, what matters, and what to do next.
- Added `npm run lab:universal-world`; 6/6 checks passed, score 100.
- Full regression suite: 447/447 passed.

## v0.54 — Cross-Photo Evidence Reasoning

v0.54 turns accumulated photos into a structured real-world evidence graph rather than a flat list of observations.

### v0.54.0 implemented
- Added `EvidenceGraph` with real-world entities, photos, claims, relations, and active-entity tracking.
- Every new photo is converted into structured photo evidence: visual identities, brand/model/serial, error codes, states, anomalies, parts, OCR text, and inferred view type.
- Added cross-photo relationship states: `same_object`, `probably_same_object`, `unresolved`, and `likely_new_object`.
- Model/serial conflicts act as hard boundaries so different devices are not silently merged.
- Explicit language such as “另外一台机器” forces a new-object branch.
- Continuity language such as “这台 / 它的屏幕 / 背面的铭牌” contributes evidence that the new photo belongs to the active object without overriding hard identity conflicts.
- Matching photos attach to the existing real-world entity; conflicting/new-object photos create a separate entity.
- Entity Evidence Summary combines photo count, view types, brand/model/serial, error codes, visual states, parts, and OCR evidence across all linked photos.
- `ProblemSolvingSession` now owns the Evidence Graph and exposes a compact active-entity summary plus the latest cross-photo relationship.
- Universal Explain surfaces cross-photo relationship confidence to the user: same/probably-same, unresolved, or likely-new-object.
- When the relation is unresolved, SeeMind asks the user to confirm whether the photo is the same device/object before merging evidence.
- Compact problem summaries expose the useful active-entity summary but not the full internal graph.
- Added `npm run lab:cross-photo`; 5/5 checks passed, score 100.
- Full regression suite: 437/437 passed.

## v0.53 — Evidence Request Intelligence

v0.53 teaches SeeMind to ask for the right next evidence instead of generically asking for a clearer photo.

### v0.53.0 implemented
- Added Evidence Gap Analyzer over Problem State, Problem Understanding, current OCR, and accumulated visual evidence.
- Added explicit evidence gap types for identity/overview, model/nameplate, error code/display, indicator detail, visual grounding, connector/cable relationship, and damage detail.
- Evidence gaps are prioritized so the next capture request targets the highest-value missing evidence.
- Added Capture Director with concrete user instructions: what to photograph, where to look, how close to get, what context to keep, and why that evidence matters.
- Nameplate requests explicitly look for BRAND / MODEL / SERIAL / VOLTAGE and avoid repeatedly requesting an already captured error display.
- Error-code requests focus on the display/error region and ask for the complete code, icon, and nearby text.
- Indicator requests ask for color, blink rhythm, and adjacent symbols/text.
- “这里/那个” grounding requests ask the user to center the referenced area while retaining enough surrounding structure for location context.
- Connection requests ask for connector, plug, cable relationship, and nearby port labels without first changing the real connection state.
- Damage-detail requests ask for close-up + contextual view and include a safety boundary against moving closer to exposed wiring, smoke, leaks, or high heat.
- Existing evidence suppresses redundant requests; recognized MODEL and ERROR evidence remove those gaps.
- Added Evidence Progress evaluation to report which gaps were resolved by a new photo and whether the evidence request is complete.
- Integrated Capture Director into Guided Troubleshooting so the highest-value evidence request becomes the primary next step.
- Added a dedicated user-facing capture card with “what to shoot / why /注意” instead of exposing internal gap schemas.
- Added `npm run lab:evidence-request`; 5/5 checks passed, score 100.
- Full regression suite: 427/427 passed.

## v0.52 — Problem Solving Dialogue

v0.52 turns the Universal Explain layer into a persistent guided troubleshooting loop.

### v0.52.0 implemented
- Added `ProblemSolvingSession` with persistent status, goal, subject, symptoms, evidence, attempts, ruled-out items, open questions, proposed steps, resolution, and escalation.
- Multiple photos in the same case now accumulate evidence instead of implicitly starting over.
- Voice/text follow-ups update the same problem state.
- User phrases such as “已经试过 / 重启过 / 拔过 / 检查过” are captured as attempted actions.
- Repeated evidence is deduplicated.
- Guided Troubleshooting Planner chooses one primary next step plus limited alternatives.
- Exact or strongly similar already-tried steps are filtered so SeeMind does not keep asking the user to repeat the same action.
- Indicator-light problems can request color/blink rhythm/error-code evidence; basic no-power/no-response problems can request the basic power path only when it has not already been tried.
- User confirmation such as “已经好了 / 解决了” closes the problem state and stops further troubleshooting.
- A later “still not working” report can reopen a previously resolved state.
- Universal Explainer now returns `problemState`, compact `problemStateSummary`, and `troubleshooting` alongside the normal explanation.
- The web flow preserves problem state across “再拍一张” and follow-up speech/text.
- Added an explicit “新问题” action to clear the current case and start a clean session.
- The user-facing explanation panel refreshes after each follow-up turn so the next step changes with new evidence.
- Added `npm run lab:problem-solving`; 5/5 checks passed, score 100.
- Full regression suite: 417/417 passed.

## v0.51 — Universal Explain Experience

v0.51 moves SeeMind from an internally capable vision stack to a user-facing “explain what I see and help me continue” experience.

### v0.51.0 implemented
- Added `UniversalExplainer` as the single user-facing composition layer over Multimodal Fusion, Problem Understanding, Resolution Router, Help Path, and Explanation & Action Contract.
- Ordinary non-receipt images now receive an explanation immediately after first upload; the user no longer has to ask a second question before SeeMind says what it can see.
- First-look explanations combine high-confidence object identity, conservative scene context, visual state/anomaly clues, OCR text, and missing-capability evidence.
- Receipt/document inputs preserve their specialized structured field view while also receiving a concise natural-language summary; ordinary images no longer get forced into a receipt-only presentation.
- Candidate visual identities remain visibly uncertain (“可能是…”) and are never promoted to “我看到了…” unless their status/confidence supports observed evidence.
- Unknown images now produce a useful evidence-seeking explanation and next step instead of fake object identification.
- Speech/text follow-up questions reuse the same Universal Explainer path, so the first-look answer and later image+voice answer share the same evidence boundaries.
- User-reported symptoms can appear in highlights while remaining separate from visually observed facts.
- Added concise `voiceText` so “读给我听” can speak a natural summary + salient evidence + one next step rather than reading the entire internal contract.
- Added dedicated Universal Explain UI block with summary, evidence highlights, confidence, and next-step guidance; internal schemas/provider/debug details remain hidden from normal users.
- Output rendering escapes OCR/vision text before inserting HTML.
- First-look UI mode distinguishes `document`, `general_vision`, `text_image`, and `unknown_image`.
- The page now labels ordinary-image results as “图片解说” instead of pretending every image is a receipt.
- Added `npm run lab:universal-explain`; 5/5 checks passed, score 100.
- Full regression suite: 409/409 passed.

## v0.50 — Visual Benchmark & Device Autotuning

v0.50 makes visual-model choice device-aware and experience-aware instead of static.

### v0.50.0 implemented
- Added Device Profile detection using available browser hints such as CPU cores, device memory, mobile user agent, WebGPU, WASM, network effective type, and Save-Data.
- Added device tiers: `low_power`, `balanced`, and `performance`, each with its own visual-memory, inference-time, and heavy-model concurrency budget.
- Added stable per-device benchmark keys so the same provider can have different performance histories on different device classes.
- Added Visual Benchmark Store with per-provider/per-capability runs, successes, failures, timeouts, average model-load time, average inference time, max inference time, and last error.
- Visual Provider Executor now records real local load/inference outcomes into the benchmark store.
- Added benchmark scoring and recommendations: `needs_benchmark`, `preferred`, `allowed`, and `avoid`.
- Repeated failures/timeouts can automatically move a provider into `avoid` instead of repeatedly making the user wait.
- Fast/reliable providers can become preferred on the current device.
- Added device-aware provider filtering/ranking; benchmark-avoid providers are skipped and historical preferred providers receive a ranking bonus.
- Heavy visual providers are automatically blocked on `low_power` devices even when the model is installed.
- Device-specific autotune policy controls visual memory budget and inference timeout passed to the Provider Executor.
- Local Student now records `device_profile` and `visual_autotune_policy` observations for explainability/debugging.
- Model Manager UI now surfaces the detected device class, core/memory hints when available, WebGPU availability, and a clear notice when heavy visual models will be automatically downgraded.
- Added `npm run lab:device-autotune`; 5/5 checks passed, score 100.
- Full regression suite: 399/399 passed.

## v0.49 — Model Manager UI & First-Run Experience

v0.49 turns model delivery into an explicit user-controlled product flow.

### v0.49.0 implemented
- Added a visible Model Manager panel to the web UI.
- The General Vision DETR provider is now **opt-in** by default; checking model status or uploading an image does not silently start a ~43 MB model download.
- Lightweight local capabilities such as OCR, speech, pixel color/state, and browser barcode/QR remain available without the General Vision model.
- Added model states: not installed, downloading, retrying, ready/offline-ready, and failed.
- Added explicit first-run confirmation before preparing the General Vision Student.
- Added user-facing download progress, estimated download size, model version, offline-ready state, failure message, retry, and delete actions.
- Added browser storage usage/quota display when the Storage API can report it.
- Added `ModelManager` service that wraps delivery state, preferences, progress events, installation, removal, and readiness checks.
- Added default model catalog with the DETR model metadata used by the UI.
- DETR's quantized ONNX weight entry is pinned to the current `model_quantized.onnx` size and SHA-256 value; small JSON metadata files remain unhashed where exact source metadata is not embedded.
- Web image analysis only enables the General Vision DETR Provider after the model has been explicitly prepared and verified in the SeeMind model cache.
- Removing the model immediately returns the application to the lightweight local-provider path without affecting OCR, speech, barcode, or other features.
- Model failure remains isolated; users can continue using the rest of SeeMind and retry later.
- Added `npm run lab:model-manager`; 5/5 checks passed, score 100.
- Full regression suite: 390/390 passed.

## v0.48 — Model Delivery & Offline Cache

v0.48 turns local model assets into a managed product resource rather than an incidental first-run download.

### v0.48.0 implemented
- Added Model Manifest contract with model ID, locked version, provider binding, file list, byte estimates, optional SHA-256 integrity, license/source metadata, and deterministic cache keys.
- Added Memory and CacheStorage model stores with metadata and storage estimation.
- Added SHA-256 integrity generation/verification; corrupted or mismatched model files are deleted and never promoted to ready.
- Added Model Delivery Manager with first-download progress events, retry recovery, offline-only enforcement, storage budget checks, cache reuse, removal, and old-version cleanup.
- Offline-only mode succeeds only when all required model files are already cached and verified.
- Added actual-URL Model Asset Store plus a lightweight Service Worker cache bridge so runtime model fetches can reuse SeeMind-managed model assets instead of merely storing an unrelated copy.
- Service Worker registration is base-path aware for deployments such as GitHub Pages rather than assuming site-root `/`.
- Added `createDetrResnet50Manifest()` catalog helper for self-hosted/bundled DETR assets; file metadata remains configurable instead of pretending unknown hashes/sizes are known.
- `TransformersDetrProvider` can optionally require a Delivery Manager + Manifest before loading the runtime, including strict `offlineOnly` mode and storage budget.
- Transformers.js browser cache is enabled when supported; deployments may still use its native cache independently when no explicit SeeMind manifest is configured.
- Added progress hooks suitable for UI states: file start, byte progress, complete, and failure/retry.
- Added `npm run lab:model-delivery`; 5/5 checks passed, score 100.
- Full regression suite: 381/381 passed.

### Important deployment boundary
The source ZIP still does not bundle DETR model weights. v0.48 provides the delivery/cache/integrity machinery. A strict offline deployment must supply the real self-hosted model files and, ideally, their SHA-256 hashes in the manifest. SeeMind will not invent integrity metadata for assets it has not actually received.

## v0.47 — First Real General-Vision Student

v0.47 is the first SeeMind release where ordinary non-document images have a concrete general-vision Student path rather than only OCR or placeholder provider contracts.

### v0.47.0 implemented
- Added `TransformersDetrProvider` using the Transformers.js `object-detection` pipeline and default model `Xenova/detr-resnet-50`.
- The provider emits real object-identity candidates, confidence, normalized bounding boxes, and common Visual Region Evidence for Grounding.
- DETR output is cached per image so `object_identity` and `scene_context` do not rerun the same detector inference.
- Added conservative scene candidates derived only from combinations of actually detected objects (for example road/street from car + traffic light); scene labels remain candidates unless evidence is strong.
- Detection absence is explicitly not treated as negative evidence because DETR uses a fixed vocabulary.
- Added local-model-only configuration: `allowRemoteModels:false` + `localModelPath` can point Transformers.js at bundled/self-hosted model assets.
- Added `@huggingface/transformers` dependency while preserving provider injection so the model/runtime remains replaceable.
- Default local visual provider set now includes the DETR provider in addition to pixel color/state and browser barcode/QR.
- Local Student now executes required visual-provider capabilities on initially unknown/general images and then recomputes the Visual Capability Plan from the actual outputs.
- High-confidence visual identity can promote the observation from generic unknown/receipt-candidate to generic `object` context.
- General Vision identity/scene/state outputs now flow into Multimodal Context and Problem Understanding.
- Candidate visual identities remain hypotheses in Explanation & Action; they are not displayed as observed facts until confidence/status supports that.
- Added `npm run lab:general-vision`; 5/5 checks passed, score 100.
- Full regression suite: 371/371 passed.

### Runtime note
The actual model package is not bundled into this source ZIP. By default, Transformers.js may download the configured model on first use; deployments that require strict offline operation should bundle/self-host the model and configure `allowRemoteModels:false` with `localModelPath`.

## v0.46 — Visual Provider Runtime & Real Local Model Adapters

v0.46 starts connecting the provider architecture to actual local execution while keeping model/runtime dependencies optional and replaceable.

### v0.46.0 implemented
- Added `VisualRuntimeManager` for provider/model load reuse, unload, state tracking, and load-timeout isolation.
- Added per-provider inference timeout in the Visual Provider Executor; a hanging provider is isolated and the next ranked provider can continue.
- Added real local `PixelColorStateProvider` that analyzes image pixel bytes locally for red/green visual presence and bright/dark image state.
- Pixel color analysis emits region evidence usable by Grounding, while explicitly refusing to interpret color presence as a diagnosis.
- Added `BrowserBarcodeProvider` adapter for the browser-native `BarcodeDetector` API when available; unsupported browsers report unavailable instead of faking support.
- Added `LocalModelRuntimeProvider` for real model runtimes with explicit runtime loader, model URL, input adapter, output adapter, lifecycle, and normalized General Vision output.
- The runtime adapter can host ONNX/WebGPU/WASM-style local model sessions without coupling SeeMind Core to one vendor/runtime.
- Missing model URL/runtime is reported as unavailable/failure; v0.46 does **not** claim that a general object/scene model is bundled when no model asset exists.
- Added default local visual provider factory with only capabilities that actually exist today: pixel color/state and browser barcode/QR.
- Heavy/general vision models remain optional plug-ins rather than hidden mandatory dependencies.
- Added `npm run lab:vision-runtime`; 5/5 checks passed, score 100.
- Full regression suite: 361/361 passed.

## v0.45 — Visual Student Provider Architecture

v0.45 separates visual capability selection from concrete model/provider choice so SeeMind can adopt future local/open-source vision models without rewriting Core.

### v0.45.0 implemented
- Added vendor-neutral `VisualProvider` contract with explicit capability scores, provider type, supported device classes, estimated memory/latency, privacy modes, reliability, version, and priority.
- Added `VisualProviderRegistry` for runtime registration/unregistration and capability/device/privacy/memory filtering.
- Added provider ranking using capability fit, reliability/history, latency, memory fit, and provider priority.
- Added per-provider and per-capability performance history for successes, failures, average latency, and last error.
- Added device-budget filtering so a heavy local model is not selected on a device that cannot safely fit it.
- Added local-first provider execution with automatic fallback to the next ranked provider when one provider fails.
- A single provider failure no longer collapses the visual task.
- If all local providers fail or a requested capability has no provider, the capability remains `unresolved`; no fake vision output is generated.
- Teacher escalation contains only the unresolved visual capabilities and retains `minimum_necessary` policy.
- Visual Analysis Plan now exposes the concrete set of capabilities that require provider execution.
- Provider architecture remains independent from OCR engine registry; specialized OCR and general visual Students can coexist instead of forcing one abstraction onto both.
- Added `npm run lab:vision-providers`; 5/5 checks passed, score 100.
- Full regression suite: 351/351 passed.

## v0.44 — General Vision Student & Visual Capability Router

v0.44 establishes a provider-neutral visual capability layer so SeeMind can grow from document/OCR intelligence toward general real-world image understanding.

### v0.44.0 implemented
- Added capability-first Visual Router for OCR text, document structure, object identity, scene context, color/state, component parts, spatial relationships, anomaly inspection, barcode/QR, visual grounding, and general vision.
- Routing is driven by the actual visual subproblem and the user's speech/text question rather than one all-purpose image model.
- Document/receipt inputs keep using specialized OCR/document paths when those are sufficient.
- Unknown-object questions request identity + scene context and only then a general-vision fallback.
- Troubleshooting language such as blinking lights, damage, leaks, faults, or non-working devices requests state/anomaly capabilities.
- Component and connection questions request part-level and spatial-relationship capabilities.
- Added General Vision Observation Contract with identity, scene, regions, states, relationships, anomalies, confidence, limitations, and explicit evidence policy.
- General-vision anomalies are observations/candidates, never automatic diagnoses.
- Added adapter from General Vision regions into the common Visual Region Evidence/Grounding layer.
- Visual Analysis Plan marks each requested capability as local or deferred and routes missing capabilities to a Vision Teacher/specialist using minimum-necessary escalation.
- Local Student now emits a `visual_capability_plan`; multimodal fusion recalculates the plan using the user's actual speech/text.
- Resolution Router can escalate specifically because required visual capabilities are missing.
- Voice-only sessions remain safe after adding the visual router.
- Added `npm run lab:vision-router`; 5/5 checks passed, score 100.
- Full regression suite: 341/341 passed.

## v0.43 — Explanation & Action Contract

v0.43 turns the internal multimodal reasoning stack into an evidence-bounded user explanation.

### v0.43.0 implemented
- Added a formal Explanation & Action Contract with six user-facing layers: observed facts, user-reported facts, assessment/inference, actions, unknowns, and escalation.
- Visual/structured facts cannot silently absorb speech-reported symptoms, history, or attempted actions.
- Intent remains an explicit hypothesis with confidence rather than a confirmed user fact.
- Unresolved structured facts and multimodal/grounding unknowns remain visible in the answer contract.
- Added confidence labels for assessment text: high, medium, and low/inference.
- `need_more_evidence` resolution plans become concrete capture/clarification actions instead of generic “provide more information”.
- Teacher/tool escalation preserves the `minimum_necessary` privacy policy and whether the original image is actually needed.
- Added fallback guidance to specialist AI/tools, authoritative manuals/databases/search, or qualified human experts when the current system cannot reliably finish the problem.
- Added Teacher Explanation Prompt contract requiring evidence boundaries and useful next-step fallback.
- Web voice/text question flow now creates and stores `explanation_action_contract` before Teacher escalation.
- The web flow shows the current evidence-bounded explanation first; lack of a configured Teacher no longer collapses the answer into only “I don't know”.
- Added `npm run lab:explanation`; 8/8 checks passed, score 100.
- Full regression suite: 331/331 passed.

## v0.42 — Visual-Language Grounding

v0.42 starts binding user language to actual image regions instead of treating references such as “这个/这里/右边红灯” as plain text.

### v0.42.0 implemented
- Added normalized Visual Region Evidence contract for OCR text regions and future semantic/object detector regions.
- OCR blocks/bounding boxes are now preserved in Student observations and converted into region evidence.
- Added region normalization for pixel or normalized bounding boxes with image-size awareness.
- Added grounding for spatial references: left, right, upper, and lower image regions.
- Added grounding for displayed number/error-code references using OCR region tags.
- Added semantic indicator grounding contract using region tags such as `indicator`, `color:red`, and `color:green`.
- “红灯” is not grounded from OCR text alone; it requires actual semantic/color region evidence.
- Generic “这里/那里” remains unresolved without pointing coordinates or a unique grounding cue.
- Added compound grounding: references such as “右边 + 红灯” must be satisfied by the same region. One strong half cannot compensate for a missing other half.
- Compound evidence can resolve individually ambiguous phrase components when the combined phrase uniquely identifies one region.
- Added explicit resolved/tentative/unresolved grounding state with region ID, bbox, confidence, candidate regions, and reason.
- Multimodal Context now carries complete grounding results and removes a reference from `unknowns` only after real grounding evidence resolves it.
- Voice-only operation remains valid; Grounding safely reports no image evidence rather than throwing.
- The Region Evidence interface is intentionally provider-neutral so future object detectors/general vision models can plug in without changing the language layer.
- Added `npm run lab:grounding`; 4/4 checks passed, score 100.
- Full regression suite: 321/321 passed.

## v0.41 — Multimodal Input & Intent Fusion

v0.41 establishes the product input model for **image + voice + optional text + session context**.

### v0.41.0 implemented
- Added Speech Evidence extraction for intent signals, symptoms, temporal context, attempted actions, visual references, and speaker uncertainty.
- Added Multimodal Fusion Context combining visual Structured Facts with user speech/text and recent conversation turns.
- Visual evidence and user-reported evidence remain separate: speech cannot create a visual fact, and vision cannot create user history.
- Added reference handling for phrases such as “这个”, “这里”, “右边”, “左边”, “红灯”, “这个代码”, and “这两个”.
- Spatial/indicator references remain unresolved until a future visual-grounding layer can actually bind them to image regions.
- Added multimodal unknown tracking for missing image evidence, unresolved references, and uncertain speech.
- Added user intent selection from speech while preserving it as an evidence-backed hypothesis.
- Added Multimodal Problem Prompt contract for Teacher/tool escalation with explicit observed facts, user-reported symptoms/actions/history, references, contradictions, and unknowns.
- Problem Understanding now receives multimodal symptoms, attempted actions, temporal context, references, and multimodal unknowns.
- Web voice/text question flow now creates a `multimodal_context` before routing the problem further.
- Recent conversation context is preserved with a bounded window rather than unbounded prompt growth.
- Added Multimodal Session contract for future multi-image / multi-voice troubleshooting.
- Added `npm run lab:multimodal`; 8/8 checks passed, score 100.
- Full regression suite: 311/311 passed.

## v0.40 — Problem Understanding & Resolution Router

Product loop: **See → Understand → Explain → Solve → Guide**.

### v0.40.0 implemented
- Added Problem Understanding model separating known facts, unknown facts, problem signals, and intent hypotheses.
- Added intent hypotheses for identify/explain, troubleshoot, solve/guide, and translate without pretending a hypothesis is a confirmed user intent.
- Added Resolution Router decisions: `local_explain`, `need_more_evidence`, and `teacher_or_tool`.
- Unknown/weak visual input now requests targeted evidence such as a full-object/context photo plus model/nameplate/error-code close-up instead of guessing.
- Conflicting evidence prefers evidence collection before confident solution claims.
- Added escalation plan with capability requests such as vision, reasoning, troubleshooting, and web search.
- Added `minimum_necessary` escalation policy: structured facts first; original image is requested only when the unresolved visual problem actually needs it.
- Added help-path fallback: when no suitable Teacher exists, recommend specialist tools, authoritative manuals/databases/search, or an appropriate qualified human expert.
- Added principle: never end at “I don't know”; state what is known, uncertainty, and the best next step.
- Local Student now emits `problem_understanding` and `resolution_plan` observations.
- Added `npm run lab:resolution`; 5/5 passed, score 100.
- Full regression suite: 301/301 passed.

## v0.39 — Universal Structured Facts / 通用事实层

v0.39 deliberately separates document understanding from accounting/business workflows.

### v0.39.0 implemented
- Added a provider/parser-neutral Fact Contract with category, name, value, unit, confidence, status, evidence, conflicts, and provenance.
- Added Universal Structured Facts aggregation across shared Receipt Parser fields and specialized document parsers.
- Shared facts are organized into identity, time, money, parties, banking, fiscal, and domain namespaces.
- Bank/SPEI results map into sender/receiver, banks, account last four digits, reference, tracking key, and transfer amount.
- CFDI results map into issuer/receiver RFC, UUID, fiscal regime, and CFDI use.
- Gas-station results map into station/CRE/fuel/liters/price-per-liter domain facts.
- Restaurant results map into tip/table/server/guest domain facts.
- Brand and legal entity remain separate identity facts.
- Original field evidence is preserved inside each fact: source text, rule, raw/normalized value, bbox, confidence, and parser/document provenance.
- Arithmetic conflicts are attached to affected facts without rewriting their values.
- Unresolved fields remain explicit facts rather than disappearing.
- Added hard policy flags: `factsOnly`, `noAccountingClassification`, `noIncomeExpenseInference`, and `noAutoPosting`.
- Student Observation now includes a separate `structured_facts` observation.
- Added `npm run lab:facts`; 5/5 passed, score 100.
- Full regression suite: 291/291 passed.

## v0.38 — Document Router / Specialized Parsers

v0.38 turns document-type recognition into actual parser routing while keeping the general receipt parser as the authority for shared financial fields.

### v0.38.0 implemented
- Added specialized Document Router with a confidence gate; low-confidence classifications do not enter a specialized parser.
- Added Gas Station parser for CRE permit, fuel product, liters/volume, and price per liter.
- Fuel `liters × price` is candidate-only arithmetic evidence and never replaces a labeled TOTAL.
- Added CFDI parser for issuer RFC, receiver RFC, UUID/Folio Fiscal, Régimen Fiscal, and Uso CFDI.
- Added Bank/SPEI parser for sender, receiver, sender/receiver bank, Clave de rastreo, Referencia, transfer amount, and account last four digits.
- Added Restaurant parser for Propina, Mesa, Mesero/a, and guest count.
- Ordinary retail/convenience receipts remain on the general parser and do not receive irrelevant specialized fields.
- Specialized parsers cannot overwrite common Receipt Parser fields such as TOTAL, IVA, SUBTOTAL, EFECTIVO, or CAMBIO.
- Student Observation now exposes a separate `specialized_document` record with routed type, parser ID, specialized fields, and checks.
- Added `npm run lab:document-router`; 5/5 passed, score 100.
- Full regression suite: 279/279 passed.

## v0.37 — Merchant & Receipt-Type Intelligence

v0.37 upgrades Student from “extract fields from receipt-like text” to “first identify what kind of document this is, then interpret fields under that context.”

### v0.37.0 implemented
- Added deterministic receipt/document type classification for convenience store, retail receipt, gas station, restaurant, CFDI invoice, bank transfer, and unknown.
- Classification uses explicit evidence with weighted indicators and confidence; weak/ambiguous text remains `unknown`.
- Added per-document field policy so, for example, bank transfers do not pretend SUBTOTAL/IVA/CAMBIO are expected fields.
- Added Merchant Identity analysis with separate `brand`, `legalEntity`, relationship, candidates, source lines, and confidence.
- Known brand detection and legal company detection can coexist; e.g. a display brand can remain the merchant while the legal company is preserved separately.
- Generic thank-you/slogan lines and common receipt labels are excluded from merchant candidates.
- Merchant selection uses auditable header/brand/legal/address evidence rather than blindly taking the first uppercase line.
- Local Student `detectedType` now reflects the classified receipt/document type.
- Existing v0.36 amount reasoning remains unchanged: no-label TOTAL is not invented, arithmetic validates rather than creates fields, and `$→5` recovery remains evidence-gated.
- Added `npm run lab:receipt-type`; 6/6 passed, score 100.
- Full regression suite: 271/271 passed.

## v0.36 — Receipt Intelligence v2 / Mexico Receipt Reasoning

v0.36 returns focus to Student vision quality and strengthens deterministic reasoning for Mexican receipts.

### v0.36.0 implemented
- Added auditable money candidate pool grouped by source line, labels, raw amount, normalized value, and centavos.
- Added explicit relation layer for cash/change/total, subtotal/IVA/discount/total, and IVA percentage validation.
- `EFECTIVO - CAMBIO` and `SUBTOTAL + IVA - DESCUENTO` may produce candidate-only TOTAL suggestions when TOTAL is missing, but `mayAutoFill` remains false.
- Arithmetic support can raise field confidence; conflicts reduce confidence but never rewrite OCR-derived values.
- Mixed evidence is represented as mixed support/conflict instead of forcing a false certainty.
- Added IVA rate validation such as `IVA 8%`: expected tax is checked against subtotal without changing the tax field.
- Expanded Spanish date support to full month names including ENERO, FEBRERO, MARZO, ABRIL, MAYO, JUNIO, JULIO, AGOSTO, SEPTIEMBRE, OCTUBRE, NOVIEMBRE, DICIEMBRE and `20 DE AGOSTO DE 2026` style.
- Preserved evidence-gated `$ → 5` TOTAL recovery and protected legitimate leading-5 amounts.
- Added receipt quality assessment with resolved core fields, supported/conflicted relations, and `needsReview`.
- Expanded Mexican Receipt Golden Suite with v2 date/tax/candidate-only cases.
- Added `npm run lab:receipt-v2`; 5/5 passed, score 100.
- Full regression suite: 260/260 passed.

## v0.35 — Portable Corpus Export / Import + Real Image Binding

v0.35 makes a reviewed real-receipt corpus portable without weakening the integrity guarantees introduced in v0.34.

### v0.35.0 implemented
- Added portable corpus export containing `corpus-package.json`, all required receipt images, and an independent `archive-manifest.json`.
- Export refuses to create a supposedly complete portable corpus when any required image is missing.
- Archive manifest records normalized path, byte size, MIME type, and SHA-256 for every payload file.
- Import validates the archive manifest before trusting Ground Truth or image content.
- Modified images, modified Ground Truth package bytes, missing files, and duplicate archive paths are rejected.
- After archive-level validation, the existing v0.34 Corpus Package verifier independently re-checks Ground Truth manifest and receipt image hashes.
- Added real-image rebinding by exact package path or SHA-256, allowing a renamed image to be safely associated with its original case.
- Filename/path matching alone is never the final integrity authority; package verification still checks image bytes.
- Portable import returns an accepted/rejected state and explicit failure reason rather than silently repairing a damaged corpus.
- Full regression suite: 246/246 passed.

## v0.34 — Corpus Package / Real Benchmark Runner

v0.34 turns reviewed receipt cases into an integrity-checked benchmark package and introduces the execution boundary for honest real-image OCR benchmarks.

### v0.34.0 implemented
- Added Eligible-only Corpus Package builder; pending, annotation, review, error, and skipped cases cannot enter the package.
- Ground Truth exported into the package excludes Student suggestion metadata and annotation UI workflow state.
- Added per-image SHA-256, size, MIME metadata, missing-image detection, and package-level hash.
- Added package verification that detects missing or replaced image bytes.
- Added Real OCR Benchmark preflight. Invalid manifests, missing images, hash mismatch, or absence of a real OCR strategy return `not_executed`.
- `not_executed` contains no fake benchmark report and no fabricated score.
- Available and unavailable OCR strategies are reported separately, so Paddle runtime absence does not masquerade as an accuracy result.
- Added Real Benchmark Runner that feeds the verified package directly into the v0.29 benchmark framework.
- Real-run output is bound to dataset ID/version, Ground Truth content hash, image package hash, and exact case count.
- Benchmark ranking still produces only a promotion candidate; regression and explicit approval remain mandatory.
- Added `npm run lab:real-ocr-benchmark`. The lab uses synthetic byte fixtures and fake deterministic strategies solely to test plumbing; it is explicitly not a real Paddle/Tesseract accuracy claim.
- Full regression suite: 237/237 passed.

## v0.33 — Corpus Persistence / Batch Annotation Queue

v0.33 makes the isolated annotation console usable for building a larger real receipt corpus without weakening privacy boundaries.

### v0.33.0 implemented
- Multi-select receipt import for batch annotation.
- Added queue states: pending, annotation, review, eligible, error, skipped.
- Added queue filters for all / pending annotation / pending review / approved.
- Added previous, next, and skip navigation without deleting unfinished work.
- Added resumable local persistence for annotation drafts, queue metadata, active case, and workflow state.
- Raw image bytes, Data URLs, and Blob contents are deliberately excluded from LocalStorage persistence.
- After browser restart, annotation progress can resume; because images are not persisted, the original image may need to be re-selected for visual review.
- Added duplicate case protection and queue summaries.
- Student suggestions, human Ground Truth, Reviewer gates, consent, and redaction requirements remain unchanged.
- Full regression suite: 229/229 passed.

## v0.32 — Annotation UI / Human Review Console

v0.32 turns the v0.31 annotation state machine into an isolated human-facing review console while keeping the normal SeeMind interface minimal.

### v0.32.0 implemented
- Added independent `annotation.html`; the normal SeeMind page remains free of Ground Truth/reviewer controls.
- Added two-column desktop review layout: receipt image on the left, Ground Truth fields on the right; responsive single-column layout on smaller screens.
- Core Mexican receipt fields are explicit and ordered: COMERCIO, FECHA, SUBTOTAL, IVA, DESCUENTO, TOTAL, EFECTIVO, CAMBIO.
- Student suggestions are visible with confidence but remain unresolved until an explicit human action.
- Per-field actions are intentionally small: confirm Student suggestion, manually edit, or mark not applicable.
- Manual money edits are normalized to integer centavos; `not_applicable` remains null and is never converted into zero.
- FECHA and TOTAL remain critical and must be resolved before submission.
- Privacy/source section requires explicit corpus-use consent and human image-redaction confirmation.
- OCR text sensitive-data findings are surfaced as a warning, without claiming that the image itself is safe.
- Reviewer mode exposes only Reject and Approve-to-Benchmark actions.
- Approved cases can be exported as clean Ground Truth JSON; Student suggestion metadata and workflow UI metadata are excluded from the export.
- The browser console does not silently write receipt images or corpus files into the repository.
- Added annotation console/UI regression coverage.
- Full regression suite: 219/219 passed.

## v0.31 — Real Corpus Intake / Annotation Workflow

v0.31 turns the v0.30 Ground Truth contract into a controlled human annotation workflow.

### v0.31.0 implemented
- Added annotation drafts generated from Student receipt observations.
- Student OCR/parser values are stored as **suggestions only**; they remain `unresolved` and never become confirmed Ground Truth automatically.
- Annotators can accept, correct, mark unresolved, or mark fields not applicable.
- Critical `date` and `total` must be human-resolved before review submission.
- Submission requires an annotator, consent confirmation, and explicit human confirmation that the image itself has been redacted.
- Added Reviewer approval/rejection workflow. Rejection returns the case to annotation; approval produces a strict benchmark-eligible case.
- Strengthened corpus eligibility: strict Benchmark validation now requires review, consent, and redaction confirmation.
- Added sensitive OCR-text finding summary to intake drafts without duplicating sensitive raw values.
- Added multi-case `ReceiptCorpusIntakeSession` with duplicate protection and stage summaries.
- Added annotation progress reporting.
- Added `npm run lab:annotation`; workflow lab score 100.
- Full regression suite: 209/209 passed.

## v0.30 — Real Receipt Benchmark Corpus / Ground Truth Tooling

v0.30 builds the data-quality boundary required before SeeMind can make honest real-world OCR accuracy claims.

### v0.30.0 implemented
- Added receipt Ground Truth schema for merchant/date/subtotal/IVA(tax)/discount/total/cash/change using integer minor currency units.
- Added reviewed/draft annotation states, annotator/reviewer metadata, provenance, consent confirmation, and image-redaction confirmation.
- Added strict corpus validation: unreviewed Ground Truth cannot silently enter the real benchmark.
- Arithmetic conflicts are flagged but Ground Truth is never silently rewritten.
- Added duplicate case detection, difficulty/type distributions, deterministic SHA-256 corpus content hashes, and tamper verification.
- Added text-side sensitive-data scanner/redactor for RFC, CURP, email, phone, and Luhn-valid payment-card numbers.
- Image redaction is deliberately not claimed automatic; a human redaction confirmation remains required.
- Added adapter from a validated corpus manifest directly into the v0.29 OCR Benchmark Dataset.
- Added empty real-corpus scaffold and a reviewed JSON template. No private real receipt images are bundled.
- Added `npm run lab:receipt-corpus`; synthetic tooling lab score 100.
- Full regression suite: 199/199 passed.
- No real Paddle/Tesseract accuracy claim is made yet because no reviewed real receipt image corpus was supplied in this source package.

## v0.29 — Real OCR Benchmark / Engine Promotion

SeeMind now has a benchmark and promotion framework for comparing OCR strategies on identical receipt cases. The framework is ready for real image fixtures, but v0.29 does not fabricate real Paddle/Tesseract accuracy where no image corpus or runtime is available.

### v0.29.0 implemented
- Added `OcrBenchmarkDataset` for versioned receipt benchmark cases with difficulty, receipt type, tags, expected fields, and critical fields.
- Added benchmark execution across multiple strategies on the same cases.
- Added field accuracy, critical-field accuracy, TOTAL accuracy, date accuracy, failure rate, latency, fallback rate, and recognition-count metrics.
- Added per-difficulty/per-receipt-type strategy grouping and overall ranking.
- Added OCR Strategy Promotion Gate: benchmark leader can only become `proposed`; regression and explicit human approval are still required before `promoted`.
- Benchmark runner isolates strategy failures instead of aborting the full benchmark.
- Added `npm run lab:ocr-benchmark` with a clearly labeled synthetic deterministic benchmark used only to validate framework behavior.
- No real-world Paddle/Tesseract accuracy claim is made in v0.29 because the current environment has no real receipt image benchmark corpus and no active Paddle runtime.
- Full regression suite: 190/190 passed.

## v0.28 — OCR Engine Health / Adaptive Routing

SeeMind no longer runs every OCR engine for every image. It now separates routing from execution and uses image difficulty plus privacy-safe aggregate engine history to decide how much OCR work is justified.

### v0.28.0 implemented
- Added `OcrEnginePerformanceStore` with attempts, successes/failures, rolling latency, evidence score, and consecutive-failure tracking.
- Added optional LocalStorage-backed aggregate history. It stores only engine metrics, never OCR text, receipt contents, images, or API secrets.
- Added conservative Bayesian-style success-rate smoothing so a single failure does not immediately ban an engine.
- Added deterministic image-difficulty classification from v0.24 quality metrics.
- Added Adaptive OCR Router scoring engine priority, smoothed success rate, evidence score, latency, failure streak, image difficulty, capabilities, and device class.
- Easy images use a primary engine with a fallback candidate and an evidence threshold for early stop.
- Hard images can trigger dual-engine competition; low-power devices keep a strict two-recognition budget.
- OCR Ensemble now records engine performance and can stop before running the fallback when the primary result is already strong.
- Primary failure still executes fallback automatically.
- Student observations now expose safe OCR routing strategy, difficulty, budget, ranking, and aggregate performance.
- Added `npm run lab:ocr-routing`: 4/4 passed, score 100.
- Full regression suite: 182/182 passed.

## v0.27 — Real PaddleOCR Integration Boundary

SeeMind now has a real local PaddleOCR service boundary instead of only an injected adapter interface.

### v0.27.0 implemented
- Added local Python PaddleOCR service under `services/paddle-ocr/` with `GET /health` and `POST /v1/ocr`.
- The service binds to `127.0.0.1` by default and lazily imports PaddleOCR/PaddlePaddle.
- If Paddle runtime is missing or cannot initialize, the service reports `503 unavailable` instead of pretending OCR is active.
- Added Gateway Paddle OCR configuration and `/v1/ocr/paddle` proxy endpoint.
- Added Gateway health reporting for Paddle OCR runtime state.
- Added browser `HttpPaddleOcrEngine`; with a configured Gateway, Student tries Paddle first and retains Tesseract fallback.
- OCR Ensemble now isolates per-engine failures. One broken OCR engine does not abort Student vision; only an all-engine failure stops OCR.
- Added safe Paddle error taxonomy: disabled, unavailable, timeout, upstream failure, invalid response.
- Preserved global multi-engine recognition budgets from v0.26.
- Local Paddle service Python syntax validated; in the current build environment `/health` correctly returned `503 unavailable` because `paddleocr` is not installed.
- Full regression suite: 172/172 passed.

## v0.26 — OCR Engine Abstraction / PaddleOCR Ready

SeeMind OCR is now provider-independent at the engine boundary. Tesseract is one registered engine, not a hard dependency of Student.

### v0.26.0 implemented
- Expanded the provider-neutral `OcrEngine` contract with version, provider type, language, capability, and priority metadata.
- Added normalized `OcrResult` contract and validation.
- Added `OcrEngineRegistry` with duplicate protection, capability filtering, language filtering, and safe public profiles.
- Updated Tesseract adapter to return the common OCR contract.
- Added `PaddleOcrEngine` adapter ready for an injected Paddle runtime; no Paddle model/runtime is falsely bundled in this release.
- Added cross-engine `runOcrEnsemble()` selection: each engine still uses v0.25 multi-pass image candidates, and winners are selected using the same deterministic receipt-evidence score.
- Added a global recognition budget across engines so multi-engine OCR cannot grow into an uncontrolled loop.
- Student accepts either the legacy single `ocrEngine` option or a new `ocrEngines` array for backward compatibility.
- Student observations now record selected engine/version and compact per-engine/per-pass scoring metadata.
- Added `npm run lab:ocr-engines`: 4/4 passed, score 100.
- Full regression suite: 166/166 passed.

## v0.25 — Multi-Pass OCR Selection

SeeMind can now OCR a bounded set of image-enhancement candidates and select the result with the strongest receipt evidence rather than blindly trusting the highest raw OCR confidence.

### v0.25.0 implemented
- Added bounded `preprocessImageCandidates()` using v0.24 quality-aware enhancement plans.
- Added `runMultiPassOcr()` with a hard maximum of 4 passes; Student currently uses at most 3.
- Each pass goes through OCR → v0.23 Normalization → v0.22 Receipt Parser before scoring.
- Selection combines OCR confidence, resolved-field completeness, critical DATE/TOTAL completeness, arithmetic consistency, normalization confidence, and a bounded recovery penalty.
- Arithmetic conflicts reduce a candidate score; supported receipt relationships increase it.
- A lower-confidence OCR result can beat a higher-confidence result when it produces substantially stronger deterministic receipt evidence.
- Student observations keep compact per-pass audit metadata and retain the full selected OCR/normalization/receipt result.
- Added `npm run lab:multi-ocr`: 3/3 passed, score 100.
- Full regression suite: 159/159 passed.

## v0.24 — Image Preprocessing Lab

SeeMind now measures image quality before OCR and chooses a conservative adaptive enhancement plan instead of applying one fixed filter to every image.

### v0.24.0 implemented
- Added brightness, contrast, edge/sharpness, dark-clipping, and highlight-clipping quality analysis.
- Added bounded adaptive plans: clean, dark recovery, bright recovery, low-contrast recovery, and a gentle grayscale baseline.
- Original image bytes remain untouched; all OCR images are derived artifacts.
- Added conservative grayscale/contrast/brightness/gamma transformation and light unsharp enhancement.
- Student observations now include image-quality metrics, selected plan, and alternative candidate plans.
- Added EXIF-orientation-aware bitmap loading where supported.
- Image preprocessing never edits OCR text or business fields; those remain the responsibility of OCR Normalization and Receipt Parser.
- Added `npm run lab:image`: 10/10 passed, score 100.
- Full regression suite: 153/153 passed.

## v0.23 — OCR Normalization / Receipt Recovery Lab

SeeMind now keeps OCR raw text immutable and inserts an auditable normalization stage before receipt parsing.

### v0.23.0 implemented
- Added `normalizeOcrText()` with `rawText`, `normalizedText`, confidence, and transformation trail.
- Student now stores both raw OCR and normalized OCR; Receipt Parser consumes only normalized text.
- Added conservative recovery for spaced/broken receipt labels and common label confusions such as `T0TAL`, `1VA`, `CAMB10`, `EFECT1V0`.
- Added amount-scoped `O/I/l → 0/1` recovery only inside decimal money-shaped tokens; no global character replacement.
- Added safe adjacent duplicate-line removal only for non-financial lines; repeated IVA/discount rows are preserved.
- Added exact `SUB\nTOTAL` recovery without inventing fields.
- Added OCR Receipt Recovery Lab (`npm run lab:ocr`): 12/12 passed, score 100.
- Full regression suite: 146/146 passed.

## v0.22 — Mexican Receipt Golden Suite

The first vertical Golden Suite now focuses on Mexican retail receipts and deterministic accounting extraction.

### v0.22.0 implemented
- Added a 30-case Mexican Receipt Golden Suite with critical-case weighting.
- Locked the rule that `SUBTOTAL`, `IVA`, `TOTAL`, `EFECTIVO`, `CAMBIO`, and discounts are distinct fields.
- Locked “no reliable TOTAL label → unresolved”; cash/change arithmetic may validate but cannot invent TOTAL.
- Added safe `$ → 5` recovery only when independent arithmetic evidence supports the recovered amount.
- Preserves legitimate leading-5 amounts when recovery evidence is absent.
- Added multi-IVA summation and multi-discount summation.
- Added deterministic discount-aware arithmetic validation: `subtotal + IVA - discount = total`.
- Prevented `PAGO CON TARJETA` from being misclassified as cash tender.
- Excluded `TOTAL DE ARTÍCULOS` and `TOTAL PARCIAL` from final TOTAL.
- Added conservative segmentation for OCR-glued summary rows such as `SUBTOTAL...IVA...TOTAL...EFECTIVO...CAMBIO...`.
- Added merchant false-positive protection for payment/discount/summary labels.
- Added `npm run golden:receipt` for a standalone 0–100 Golden Suite score.
- Mexican Receipt Golden Suite: 30/30 passed, score 100.
- Full regression suite: 138/138 passed.

## v0.21 — Golden Dataset / Evaluation Lab

SeeMind now has a versioned, provider-independent Golden Dataset and Evaluation Lab. It can run the same cases against a baseline and a candidate, compare nested expected truth, report per-domain scores, identify improvements/regressions, and block promotion when a critical case regresses.

### v0.21.0 implemented
- Added `GoldenDataset` / `GoldenCase` contracts with stable IDs, tags, task domains, weights, and critical-case markers.
- Added `Evaluation Lab` runner with nested expected-vs-actual comparison and per-task score reports.
- Added baseline-vs-candidate comparison with explicit improvements, regressions, and critical regressions.
- Added governance bridge so Golden regression reports feed the existing Candidate promotion gate.
- Seeded the first core Golden cases: Mexican receipt SUBTOTAL/IVA/TOTAL, no-TOTAL-no-guess, `$→5` recovery with evidence, legitimate leading-5 preservation, Spanish month date, current-price freshness, unsupported current fact, unsupported Teacher fact, identity-before-search, and crash-recovery idempotency.
- Golden cases contain synthetic/minimal inputs only; raw user receipts, images, conversations, API keys, and Teacher answers are not automatically promoted into the dataset.
- Regression suite: 136 tests passing.

## v0.20 — Evaluation / Failure Analysis

SeeMind now turns the privacy-safe Audit Event Log into an **offline EvaluationResult** after Planner executions. Failures are classified by responsibility instead of being flattened into “AI failed”: perception/OCR, entity identity, router, Teacher output, Search/source, evidence, provider health, schema/contract, missing user input, budget, and node execution.

Evaluation may create an `ImprovementCandidate`, but it **cannot change production behavior automatically**. Candidate governance is intentionally gated:

```text
proposed
  → offline_evaluated
  → regression_passed
  → explicit approval
  → promoted
```

Any critical regression rejects the candidate. API keys, raw OCR, prompts, answers, conversations, and image payloads remain outside Evaluation artifacts; Evaluation uses the redacted audit metadata produced in v0.19.

### v0.20.0 implemented
- Added `core/evaluation/evaluator.js` with responsibility-based failure taxonomy and quality scoring.
- Added `evaluation-pipeline.js` to evaluate completed Planner executions from their durable audit stream.
- Added `improvement-candidate.js` for safe, non-production change proposals.
- Added `candidate-governance.js` enforcing offline evaluation, regression, explicit approval, and promotion order.
- Planner failure events now include safe node type/error codes so Evaluation can locate the responsible subsystem.
- Search failures now emit explicit privacy-safe audit events.
- Explicit user feedback can reveal failures that telemetry alone cannot infer, such as a wrong entity.
- Evaluation failures never break the user task; the production execution result remains authoritative.


SeeMind 的可见界面继续保持极简：**👁 看、🎙 听、🔊 说**。Planner、Task Graph、Router、Evidence 等复杂能力隐藏在后台。


## v0.17 — Planner Execution Orchestrator

Task Graph 现在不只是计划元数据，而是可执行工作流：

```text
Planner
  ↓
Task Graph
  ↓
Execution Orchestrator
  ↓
Handler Registry
  ├─ Identity Handler
  ├─ Search Handler
  ├─ Teacher Handler
  ├─ Evidence Handler
  └─ Result Handler
```

### v0.17.0 已实现
- 新增 `NodeHandlerRegistry`，Planner/Runner 不依赖具体业务模块。
- 新增 `PlannerExecutionOrchestrator`，负责创建、执行、暂停/恢复和取消真实 Task Graph。
- 新增隔离的 `ExecutionContext`，保存当前 Canonical Entity、Evidence、最终 Result、warnings 与 trace。
- Identity Handler 可调用现有 Teacher 身份验证 Contract；身份不可靠时 `ASK USER`，不猜。
- Search Handler 复用现有 Search Planner、Evidence Retrieval Strategy 与 Consensus，支持有目标的多轮追证和 `maxSearches`。
- Teacher Handler 每次只执行当前节点，不能越过 Task Graph 抢做后续步骤。
- Evidence Handler 会检查来源冲突；未解决的高质量冲突会暂停/要求继续查证，而不是伪造确定结论。
- 必需节点失败阻断下游；可选节点失败允许降级。
- Web 复杂问题已接入 Execution Orchestrator；普通简单问题继续走轻量 Teacher 路径。
- Execution Snapshot 不包含 Provider Secret/API Key。
- 自动回归测试提升到 110 项。

## v0.16 — Planner / Task Graph

复杂维修示例：

```text
识别设备
  ↓
确认身份
  ↓
找官方说明书
  ↓
形成诊断候选
  ↓
验证诊断证据
  ↓
给解决方案
  ↓
(可选) 找配件 → 查当前价格
  ↓
最终建议
```

### v0.16.0 已实现
- 新增 provider-independent `TaskGraph` / `TaskNode` 核心模型。
- 节点支持 `pending / running / blocked / completed / failed / cancelled / skipped` 状态。
- 强制依赖顺序并检测循环依赖；无效图在执行前直接拒绝。
- 新增 Planner 模板：troubleshooting / comparison-shopping / manual / research。
- 简单任务只生成单节点，不为使用 Agent 而强行多步骤。
- 每个 Graph 有 `maxSteps / maxFailures / maxRetries / maxLatencyMs` 硬预算，禁止无限 Agent Loop。
- 必需节点失败会停止；可选节点失败可以降级继续。
- 节点可以返回 `ask_user` 暂停；用户补充信息后可恢复，不猜缺失信息。
- 支持显式取消 Task Graph。
- Task Package Compiler 会为复杂问题加入安全 `planning` Context；Teacher 只看到计划元数据，不看到执行器内部实现。
- Privacy Sanitizer 会保留必要的 Task Graph 元数据并裁剪到最小必要范围。
- Gateway Teacher Prompt 明确要求遵守节点依赖与预算，不能自行添加无限步骤。


## v0.9 — Student / Teacher Collaboration Intelligence

```text
👁 Student 先看
      ↓
Known / Uncertain / Unknown / Conflicts
      ↓
Collaboration Brief
      ↓
Teacher Router
(任务专长 + 历史成功率 + 延迟 + 健康 + 成本)
      ↓
最合适的 Teacher
      ↓
Answer Contract + Evidence Judge
      ↓
可信结果 + 🔊
```

### v0.9.0 已实现
- 新增 Student Collaboration Brief：把 Student 输出拆成 `known / uncertain / unknown / limitations / teacherQuestions / focus`。
- 高置信字段会告诉 Teacher “不要无意义重做”；低置信、未识别和冲突项会被明确列为重点核对对象。
- Task Package Compiler 自动加入 Collaboration Brief，Teacher Prompt 也明确要求只有更强证据才能覆盖 Student 的高置信结果。
- Privacy Sanitizer 会对 Collaboration Brief 做同样的最小必要裁剪与脱敏，避免协作层绕过隐私规则。
- 新增 task-aware Teacher Performance Store：按任务类型记录成功率、平均延迟和平均成本。
- Router 可以用真实历史表现动态调整 Teacher 排名，而不是永远相信静态 Provider 宣称分数。
- Gateway Teacher Manager 增加 attempts / successes / successRate / avgLatencyMs 运行统计，并继续隐藏上游错误细节。
- 继续保留 v0.8 的 Vision 上传授权、图片证据、熔断/半开放恢复和 Provider Independence。

### 仍然刻意没有做
- 不让 Student 自己变成大型推理模型；Student 仍以本地感知、结构化和不确定性表达为主。
- 不自动永久保存 Teacher 历史表现；当前是可替换的内存 Store，后续再接数据库。
- 不因为历史成功率高就绕过证据、安全、隐私或用户确认硬限制。
- 不内置任何商业 AI API Key。

## 本地运行

```bash
npm install
npm run dev
```

Gateway：

```bash
npm run gateway
```

然后浏览器打开：

```text
http://localhost:5173/?gateway=http://127.0.0.1:8787
```

## 测试

```bash
npm test
```

墨西哥票据规则继续保持：**SUBTOTAL / IVA / TOTAL / EFECTIVO / CAMBIO 必须区分；没有可靠证据就留空。Unknown is better than a plausible-looking guess.**

## v0.10 Search / Freshness Intelligence
SeeMind now distinguishes ordinary knowledge from information that must be checked against the current world. Queries such as current prices, availability, opening status, news, regulations, exchange rates, and other fast-changing information produce an explicit Freshness Requirement and Search Plan.

Search is a separate capability from Teacher reasoning. The browser sends only the search plan to the SeeMind Gateway; search provider credentials remain server-side. Search results become timestamped Evidence records. When freshness is required, a Teacher cannot turn model memory, OCR text, or an image alone into a current factual or price claim: the Claim Judge requires fresh Search Evidence or the result must remain unknown/unverified.

If no search provider is configured, SeeMind degrades explicitly instead of pretending that an LLM memory answer is current. Configure the optional `SEEMIND_SEARCH_*` variables in `gateway/.env.example` to connect a server-side JSON search adapter.


## Entity Identity Brain (v0.11)

SeeMind now separates **what was read** from **what the thing actually is**. Identity is represented as a canonical entity with its own confidence, candidates, evidence references and conflicts. Tasks that depend on exact identity (price, manuals, compatibility, parts, repair) receive a stricter identity gate; unresolved identity is a valid result and must not be guessed.


## v0.12 Identity → Search → Verify

Identity-dependent tasks now follow a strict order: Student observation → identity verification → Canonical Entity → fresh Search Evidence → Teacher synthesis → Evidence Judge. Search is never allowed to run against a weak or conflicting identity. The Teacher identity proposal must cite supplied visual/field evidence and pass a confidence threshold before it can become session identity context.

The privacy sanitizer preserves only the safe provenance required to verify search freshness (source type, URL/title, publisher and timestamps); provider secrets remain server-side.

## v0.13 Source Quality / Evidence Ranking

SeeMind now evaluates evidence by **task-specific source quality**, not merely by the presence of a URL. Government/official sources, professional databases, retailers, general web pages and community content receive different authority and task-fit weights. A retailer can be appropriate evidence for a current price while a government or official source is preferred for regulation, safety or authoritative specifications.

- Search Evidence now carries a safe `sourceQuality` profile with source type, task fit, authority score and A–E tier.
- Fresh current claims must cite not only fresh Search Evidence, but evidence that clears the task-specific quality threshold.
- Independent source origins and publishers can be counted so duplicate pages do not masquerade as corroboration.
- Search providers may attach `claimKey` / `claimValue`; explicit disagreements across sources are detected and block a definitive claim as `source_conflict`.
- Privacy sanitization preserves only the safe provenance/quality fields required by the Judge.
- Provider credentials and secrets remain server-side.



## v0.14 Evidence Consensus / Conflict Resolution

SeeMind now evaluates **evidence families and consensus**, not raw page counts. Search results can declare `sourceGroup`, `upstreamSource`, `canonicalSource`, and `isPrimarySource` so syndicated or republished pages do not masquerade as independent corroboration.

- Independent agreeing source families form an explicit consensus signal.
- Conflicting values are ranked by task-specific source quality, directness, freshness, and independent-family support.
- A clearly superior primary/authoritative/direct source may resolve a conflict only with a recorded caveat.
- Close high-quality disagreements remain `unresolved`; the Teacher must report the disagreement or request further search rather than selecting a convenient answer.
- Identity → Search workflow now attaches an `evidenceConsensus` summary and `consensusRecommendation` to the Search Plan.
- Privacy sanitization preserves only safe consensus/provenance metadata needed by the Teacher and Judge.
- Resolved conflicts are warnings; unresolved conflicts remain blocking validation failures.

## v0.18.0 — Crash Recovery

Complex Planner executions now checkpoint at meaningful state transitions. If the browser closes or the device interrupts the page, SeeMind can recover the Task Graph, verified entity, evidence, completed node receipts, remaining budget state, warnings and trace without serializing Teacher/Search runtime objects or API credentials.

For privacy, image media payloads are deliberately omitted from durable checkpoints. If an unfinished step still requires vision after restart, the user must re-select the original image. Completed nodes are not rerun. Stable per-node idempotency keys are sent to the Gateway so a repeated request can be replayed instead of charging or executing twice when the Gateway still has the receipt.


## v0.19 Audit / Replay

SeeMind keeps a privacy-safe task black box separate from crash-recovery checkpoints. It records execution metadata such as node transitions, Teacher selection scores/reasons, search escalation, evidence consensus, validation outcomes, and failures. Raw images, OCR text, prompts, answers, conversations, API keys, tokens, and credentials are not retained in the audit event stream. `core/audit/audit-replay.js` can reconstruct an execution summary for debugging and evaluation.

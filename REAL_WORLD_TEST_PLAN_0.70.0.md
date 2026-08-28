# SeeMind v0.70.0 — Real-World Test Plan

## Test principle

Do not help the system pass. Use SeeMind like a normal person: casual photos, imperfect speech, incomplete questions, glare, blur, small text, mixed Chinese/Spanish/English, follow-up corrections, and ambiguous references.

## Phase A — Eyes

Test at least 30 real images across products, receipts/documents, plants/food/objects, equipment/interfaces, indoor/outdoor scenes and unknown objects.

For each case record:
- what the object actually is;
- what Student observed;
- whether exact details (brand/model/amount/text) were correct;
- whether uncertainty was admitted when appropriate;
- whether targeted recovery improved the result;
- whether Teacher escalation was necessary.

Include deliberate hard cases: glare, blur, tilt, low light, tiny text, partial crop, similar models, `$` vs `5`, `0` vs `O`, `1` vs `I`.

## Phase B — Ears

Test at least 20 real voice turns in Mandarin, Spanish and mixed-language speech where practical.

Include:
- natural speed;
- pauses and self-correction;
- background noise;
- short critical negations such as “要 / 不要”;
- product/model numbers;
- money and dates;
- follow-up references such as “这个”“刚才那个”“右边的”.

Measure transcription accuracy, intent accuracy, correction handling and whether uncertain spans are rechecked rather than guessed.

## Phase C — Understanding

Use multi-intent questions such as:

- “这是什么？附近哪里可以买？哪家划算？有什么区别？”
- “这个小票总额是多少，税是多少，为什么现金和找零对不上？”
- “这是什么型号？我刚才拍的另一个是不是同一个？”

Check whether SeeMind preserves already-known facts, separates subgoals, avoids repeating completed work, and asks only decisive clarification questions.

## Phase D — Borrow intelligence

For cases Student cannot solve:
- verify that SeeMind identifies the missing capability rather than blindly choosing a brand;
- confirm the selected Teacher is eligible for the task;
- check failover when the first Teacher is unavailable;
- verify that Teacher output is treated as candidate evidence, not automatic truth;
- record whether the Teacher actually rescued the unresolved gap.

## Phase E — Failure behavior

Deliberately test:
- offline mode;
- Teacher unavailable;
- search unavailable;
- contradictory sources;
- ambiguous image;
- ambiguous speech;
- user correction after a confident answer.

Passing behavior is not “always answers”. Passing behavior includes saying Unknown / Uncertain, asking for a better view, reporting source disagreement, or explaining that an external capability is unavailable.

## Metrics to collect

Primary:
- exact-field accuracy;
- object / intent accuracy;
- overconfidence rate;
- Teacher escalation rate;
- Teacher rescue rate;
- false escalation rate;
- verification rejection / conflict rate;
- median and p95 response latency.

Secondary:
- repeated-work rate;
- user correction rate;
- memory usage / browser reloads;
- offline completion rate;
- battery / heat observations on long sessions.

## Stop / release rule

Do not respond to failures by immediately adding another architecture layer. First classify each failure as:

**Perception / Understanding / Evidence / Routing / Teacher / Verification / UI / Performance / Environment.**

Only repeated failures that cannot be fixed inside an existing authority justify a structural change.

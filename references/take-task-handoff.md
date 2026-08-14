# Take Task Handoff

Use for existing-task handoff handling.

The `Take Handoff, ...` receiving forms below are existing-task read operations. Standalone "handoff," "hand this off," "handoff to <agent>," "make this a task," or similar creates a new task from the live conversation under `create-task.md`, even when another task is current. Append to an existing task only when the Director names that task or says "handoff this/current task."

Taking a handoff is a read/analyze/evaluate/report operation.

Mutation gate: taking a handoff does not by itself authorize modifying source code, design specifications, docs, task state, task logs, rules, sessions, or other durable artifacts. Continue into mutation only when the Director already gave separate explicit implementation or write authorization in the current turn: says to implement, continue implementation, make the change, update the spec, write the log, edit the document, or gives equivalent explicit direction.

Default endpoint: provide an opinionated evaluation, not just a summary, unless the Director explicitly asks only for a summary. Explain the current task state briefly, then evaluate the current handoff span for feasibility, risks, questionable assumptions, implementation issues, and fit with Director intent. Recommend the best next path when evidence supports one, including why it is preferable and what tradeoffs or checks remain. Do not push the Director to choose immediately; the Director may want discussion or more facts before deciding.

## Invocation Vocabulary

This section owns the handoff invocation vocabulary. The sets below are a guaranteed minimum, not an exhaustive command reference. An unlisted verb resolves by the direction it names rather than by string matching the table.

| Direction | Anchored forms | Resolution |
| --- | --- | --- |
| Giving handoff | `Handoff, Request Design Review`; `Handoff, Request Implementation Review`; `Handoff, Review Results`; `Handoff, Request Review` | The leading verb is optional. `Write`, `Save`, `Create`, and `Store` also resolve as giving, as does omitting the verb. In this column only, `Request` marks an ask and its absence marks a delivery. |
| Receiving handoff | `Take Handoff, Review Design`; `Take Handoff, Review Implementation`; `Take Handoff, Evaluate Review`; `Take Handoff, Implement`; `Take Handoff, Review` | The verb is required. `Take` is canonical; `Receive` and `Get` also resolve as receiving. |

The asymmetry is semantic: a handoff is the act of giving, so the bare word already names the giving side. Every receiving phrase is an instruction to act and is therefore an ask in the ordinary sense; `Request` carries no direction signal there.

`Handoff, Request Review` and `Take Handoff, Review` are resolved forms, not fixed-kind forms. They name no review kind and are settled by the review-purpose ladder below. Resolving bare `Review` is safe because it is underspecified rather than ambiguous: it can only mean less than the Director intended, not the opposite. By contrast, the retired `Review for Implementation` could flip direction or purpose. Use `Handoff, Request Implementation Review` when asking another agent to review implemented work, and use `Take Handoff, Implement` when instructing the receiving agent to implement.

A phrase mixing a receiving verb with a giving-side object, such as `Get Handoff, Review Results`, is outside the guaranteed set. Ask for clarification rather than inventing a precedence rule for a combination the Director does not use.

Implementation means everything the design asked to be built: executable code, shipped reference prose that instructs agent behavior, tests, and helper output contracts. It does not mean only `scripts/`.

## Task Resolution

Resolve the task from the current-task sentinel unless the Director names a task in the current instruction. Pass `--task` to `scripts/prepare-handoff.js` only when the Director names a task now; never pass a task identifier remembered from earlier in the session. Omitting `--task` is safer because the sentinel follows a Director task switch while session memory may not.

The first line of your response names the resolved task and the purpose you are applying, for example `Task t0036 from the current sentinel; resolving this as implementation.` That makes a wrong task or wrong review kind visible before a deliverable is completed.

A handoff resolved onto a closed task has no work to pick up. Say so in one sentence and stop. Do not make `prepare-handoff.js` refuse explicit closed-task lookup; reading closed history is legitimate, and the explicit flag is usually deliberate. The helper makes closed state loud instead.

## Review-Purpose Resolution

For underspecified review instructions, resolve only from direct signals or impossibility. Never choose a kind because it seems more likely.

A writer resolving `Handoff, Request Review` uses this ladder:

1. An explicitly named kind wins.
2. Otherwise use the kind of work just completed, when the resolving agent directly knows that work.
3. Otherwise use impossibility: if no items are cleared, no implementation exists and the review request resolves to design review.
4. Otherwise ask.

After compaction or saved-context restore, the writer must not reconstruct the just-completed kind from likelihood when that reasoning was dropped. It falls through to impossibility or asks.

A receiver resolving `Take Handoff, Review` uses this ladder:

1. An explicitly named kind wins.
2. Otherwise use the declaration in the handoff being taken.
3. Otherwise use impossibility, including older records predating this rule and records that were not written as handoffs.
4. Otherwise ask.

State the resolution in one sentence and proceed. When the answer is that there is nothing to review, say so and stop.

## Receipt State

`scripts/prepare-handoff.js` makes the task source and task state explicit. It names whether the task came from the current-task sentinel or an explicit flag, and it states open or closed in words rather than leaving that encoded only in the folder prefix.

The helper reports only one state-derived implementation-review blocker: when a design specification has items and none are cleared, no implementation has been reported and implementation review is unavailable. It does not claim to resolve direction, because a request and a delivery can occupy the same task state.

A task with no design specification is a different case. The receipt says there is no design specification in its own words, and the receiver says so and stops unless the task logs name a different explicit review target.

## Review Independence

Review independence is a working practice, not a write permission. A design or implementation reviewed only by the agent that produced it carries little independent signal; when the Director wants another pass, the Director brings in another agent through a handoff. The arriving reviewer tests the current handoff span against the active design, prior decisions, and repository behavior, then records defects, accepted work, and residual risk.

Either agent may write design items when the Director has approved the item, and either agent may fix implementation defects inside approved scope. A reviewer is not required to hand a fix back to the prior implementer. When a reviewer applies a fix, the reviewer records what was fixed in the review or completion record so the defect remains visible rather than being silently smoothed over.

The boundary is scope, not author identity. A fix inside an approved item is execution. A change that alters what the item requires is a design revision and needs Director approval under `write-task-log.md` and `write-design-spec.md`.

## Procedure

1. Use `scripts/prepare-handoff.js` to produce the handoff receipt. Pass an explicit task number such as `--task t0005` only when the Director names one in the current instruction. The helper resolves the running agent, derives your read-cursor from task-log authorship, reports task source, task state, unread records, design-spec shape, current item count, unabsorbed items, cleared-but-unresolved item versions, records since the current blob changed, open dependency links, collision groups, member authors, and the newest active-item list plus its source record. Pass `--agent <token>` only for the override cases enumerated in `startup-contract.md`, where automatic identity is unavailable.
2. If the receipt reports `orphanedSpecMembers` other than `(none)`, run `scripts/repair-task-spec-log.js` for that task before relying on the handoff history. Surface the repair helper's `announcement` field in your reply. This path announces rather than asks because the repair record is fully derived and contains nothing for the Director to approve.
3. Read `task.md`. For a legacy `specMember` receipt, read that member or use `scripts/read-design-spec.js` to assemble the legacy latest snapshot. For a new-format receipt, read only the design items needed with `scripts/read-member.js --container specification --item <number>`, or use `scripts/read-design-spec.js` when an assembled view is genuinely needed. Then read the task-log span after the reported `readCursor` with `scripts/read-member-span.js --container task-log --after <read-cursor>`. If the read-cursor is `0`, read from the beginning.
4. If the Director requests all logs or a specific range, follow that request even when it goes beyond the derived read-cursor catch-up.
5. Treat record order as the handoff order. Multiple consecutive records may come from the same agent. Keep two mental buckets: background history and current handoff span. Older loaded records can explain why the task got here, but they must not override later records, the current design specification, or the Director, and they must not resurrect resolved issues as current.
6. Report the task-load boundary when logs were not fully read: state which log records were read as the current span, what read-cursor was used, whether older records were read only as background, and whether older logs were skipped because they were before the read-cursor, outside the requested range, or past an apparent topic boundary. Offer to read another chunk or search older logs when more history may matter.
7. Evaluate for the purpose visible in the Director request and handoff material. Resolve underspecified reviews with the ladder above. The purpose guidance lives in `write-task-log.md`; do not treat its kinds as exhaustive. The current handoff span is a set of claims and direction to test, not merely material to summarize. Ask: what does this design fail to handle that has actually happened in this project before?
8. For new-format design specification tasks, surface implementer-raised unabsorbed items to the Director when the handoff span suggests they were added without the required ask, or when any other Director ruling is still pending. Do not treat every unabsorbed implementer-raised item as needing a second approval gate; under the normal v9 flow, approval happened before the item was added. Ordinary direction questions carry your recommendation, so silence is a valid answer and you may continue on the stated default; item approval obligates an answer because adding an item is permanent. Continue only work that does not depend on a pending answer. If no interactive prompt is available, lead the response with the ask; Codex's structured prompt is gated to Plan mode, so ordinary Codex sessions use plain text. The handoff receipt reports the unabsorbed count; inspect the relevant log span when the count matters.
9. Respond with:
   - current task state in brief
   - what changed in the current handoff span
   - evaluation of feasibility, risks, assumptions, and implementation/spec issues
   - recommended next path, or the top alternatives ranked when no single path is clearly best
   - open questions or checks that matter before mutation

   Do not make the Director infer the recommendation from a neutral summary. If evidence is insufficient for a recommendation, say what evidence is missing and what to inspect next. Do not begin any mutation without the authorization named in the mutation gate above.

## Chained Instructions

A Director instruction may chain several actions, for example `Take Handoff, Evaluate Review, Fold in changes, Write Handoff`. Execute every action in the order given. Do not treat the first action as the whole instruction and do not drop the tail.

A trailing giving-side phrase authorizes the handoff write in advance. A chain that ends without a giving-side phrase does not authorize a handoff write. Where the Director does not chain a write, perform the named work and write nothing. The extra round trip is intended: it preserves Director control over when a handoff is written, and chaining is the opt-in escape hatch.

When the Director has authorized implementation, collapse the work into as few slices as you can live with. Only true dependency defers; do not hold back independent items because they sit near a deferred one. The active-item list is authored by the agent writing the log, using the values returned by `prepare-handoff`; the helper verifies freshness and accounting but never decides what is still outstanding.

## Conversation-Created Handoffs

Some tasks are created directly from a live conversation via the standalone-handoff phrases above. Treat these as ordinary tasks. The named handoff agent may be the same agent that created the task; this still means the Director wanted a durable context-switch point. The first log entry is expected to contain the compressed conversation state needed to resume: decisions, open questions, current reasoning, alternatives considered, and recommended next move.

When taking this kind of handoff, read `task.md` and the initial handoff log before deciding whether more log history is needed. Do not require a separate session entry; sessions are optional broader continuity records, not the canonical task state.

## Guardrails

- Do not assume the newest log record is a complete handoff.
- Do not assume one log record per agent turn.
- Do not skip same-agent consecutive records.
- The derived read-cursor and last-known record are read state only: valid for reading unseen handoff entries, never authority for writing. Write helpers assign new `log.zip` record numbers, and active-item freshness is validated against the current newest record.
- If the helper reports collision groups, read every file in that collision group and report the duplicate record number.
- "Take this handoff" is permission to analyze, evaluate, verify, and report only; see the mutation gate above.
- Do not ask whether to perform implied read/analyze/verify steps. Do ask one concise question when a requested mutation is ambiguous, broader than the Director appears to realize, destructive, conflicting with protocol or prior Director intent, or unsafe without clarification.

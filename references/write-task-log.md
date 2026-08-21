# Write Task Log

Use when the Director asks to write a task log entry without changing the current specification, or when protocol requires a task-scoped checkpoint.

## Procedure

Use `scripts/write-task-log.js`. The helper owns record numbering, timestamps, member naming, task operation locking, ZIP locking, and formatting.

The helper generates YAML frontmatter, `# <title>`, and `## Agent Response: <agent>`. Supply only the body that belongs under `## Agent Response: <agent>`; do not reproduce that generated heading. Use `--director-intent` when a concise Director-framed ask would help future readers, for example the actual request or reason for the log in the Director's terms.

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Do not read existing `log.zip` entries merely to write the next log; write from the current request, conversation state, and evidence already gathered. Lookup helpers are for handoff/resume, summarization, or explicit history questions, not normal writes. Rationale: emit, don't look. Require the output that makes loss visible rather than relying on an agent's self-assessment that it was thorough.
3. Call the helper once with direct arguments plus raw/plain body content using `helper-write-conventions.md`.
4. Reply briefly, e.g. `Logged the update for t0005.`

Example:

```bash
node <this-skill>/scripts/write-task-log.js --task t0005 --project-id 7 --agent codex --title "short descriptive title" --no-spec-update-needed-because "Review only." --director-intent "Record the review outcome for the current task."
```

The `--agent` flag is an override for tests, synthetic authors, and source-checkout runs; ordinary installed helpers resolve the running agent automatically. Any agent may write a task log when acting on Director intent; chronology, active items, and handoff review carry coordination.

When the running provider exposes a transcript/session ID, the helper automatically records it in the task's `Agents.json` after resolving the agent identity. It reads `CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`/`CODEX_SESSION_ID`, or `ANTIGRAVITY_CONVERSATION_ID` as appropriate; agents do not pass a provider-session argument.

Director-invoked context save is not a task-log write. Use `references/context-save-restore.md` and `scripts/save-context.js` instead.

## Entry Standard

Write what cannot be recovered from artifacts: why a path was chosen, what was rejected, what the Director ruled, what was checked and found clean, what was not checked, and the next useful handoff notes. Do not restate the task objective or specification except as a delta.

When an active-item list is in play, the newest log entry restates the complete set of still-outstanding items. Presence means active; absence means done. The helper checks the emitted list but never authors it.

Active-item sections use these task-log grammar markers. This file owns the grammar; `write-design-spec.md` owns projection of items into `specification.zip`.

- `## Active Items`; the helper computes and commits `derives from NNNN` for non-initial records under the write lock. Agents may omit the parenthetical or carry a stale one; item accounting is still checked against the current predecessor.
- `## Cleared`, carrying only items cleared by this record. On new-format design-specification tasks, each entry uses `VERSION NNNN:` immediately after the tag and must name the item's current version.
- `## Resolved`, carrying reviewer resolution events. On new-format design-specification tasks, each entry uses the same `VERSION NNNN:` form. The named version must exist for that item, but it does not have to be current.
- `## Dependencies`, only in paired `write-design-spec.js` logs. Task-log-only writes refuse dependency entries because they do not write item frontmatter.
- `NOTE:` and `PROPOSAL:` as the first non-whitespace token on a line.

Active items use stable numeric tags. The numeric prefix is the item identity; the slug is human commentary and may be reworded without changing identity. Matching is numeric, so `[5-item-members]` and `[0005-item-members]` are the same item. New design-specification item tags should be zero-padded, for example `[0005-item-members]`.

Adding an item to `## Active Items` is how a design specification item is born. The trigger must be explicit Director or agent phrasing, such as "add a design item" or "add a specification item"; do not infer a new durable item from a vague gesture at possible work. Any agent may add a design item only with Director approval. On approval, add the item as normal. On refusal, do not add it. If the Director reshapes the gap rather than dismissing it, add the item as the Director described it. If the ask goes unanswered, do not add the item; record the unanswered ask in the handoff if another agent needs to revisit it. On tasks using the new design-specification format, newly-added active items must use numeric tags so they can be absorbed into `specification.zip`.

An agent that raises a design item must name that item in its visible response, not only in the durable log. For general Director-ruling questions, follow the execution contract: ask in the conversation, include the recommendation for ordinary direction questions, and lead with the ask when no interactive prompt is available.

A defect in work already covered by an item keeps the existing item open until the defect is fixed. Only a gap being plugged, meaning scope the current enumeration does not cover, introduces a new design item. Do not mint new items for ordinary bugs in an existing item.

```markdown
## Active Items
- [0005-registry] REVISION: consumed-temp registry drained by runCli on success only

## Cleared
- [0004-alias] VERSION 0013: removed the --task-as-title alias from create-task

## Resolved
- [0003-parser] VERSION 0012: reviewer verified the parser change

## Dependencies
- [0005-registry] 0001, 0002
```

Use `- (none)` under `## Active Items` to clear the last item. When an implementer clears everything, the active list is `- (none)`; the record itself and its `## Cleared` section are the handoff. Do not create a marker item such as "review needed" just to keep the list non-empty. The task remains active until its folder is closed.

The helper refuses a missing carry-forward section, an unaccounted predecessor tag, or a cleared tag that was not active in the predecessor. On new-format design-specification tasks it also refuses a Cleared or Resolved entry with no `VERSION`, a Cleared entry naming anything other than the current version, and a Resolved entry naming a version that never existed for that item. It does not refuse solely because the typed derives-from value is stale; it rewrites that bookkeeping value before committing. If the predecessor list is grandfathered and untagged, the helper enforces only carry-forward and reports that accounting was skipped.

## Handoff Records

The startup memory-write rule in `startup-contract.md` owns authorization: do not write or propose session, task, or handoff memory unless the Director explicitly requests it. For this helper, that means write a handoff when the Director asks for one, not when the work feels finished. Readiness means the state is ready for a good handoff to be written, not that one exists.

This placement matters because the temptation happens here. A pre-written handoff is unverified, and confirming it costs about what the extra round trip would have cost. A record written before the discussion that would have improved it is stale on arrival, and append-only storage preserves that stale state.

A record that functions as a handoff must declare what it asks of the next agent. This obligation applies only when the record is meant to transfer work to another agent; ordinary work notes and checkpoints are exempt unless they are being used as the transfer point. Use the Director's stated purpose when one was given, because anchored giving-side phrases in `take-task-handoff.md` supply it directly. When none was given, state the purpose implied by the work just completed.

The declaration is one line and names the ask rather than restating what was done. The entry standard above already covers the work itself.

Write toward the purpose rather than dumping everything. These kinds are illustrative, not exhaustive:

| Purpose | Writer foregrounds | Reader checks |
| --- | --- | --- |
| Design/planning | decisions, rejected alternatives, constraints, open questions | fit with Director intent, ambiguity, feasibility, missing constraints |
| Specification to implementation | exact changed requirements, acceptance, risky assumptions | implementability, hidden compatibility work, likely regression surfaces |
| Implementation review | touched paths, negative checks, tests, residual risks | behavior against spec, regressions, missing tests, shortcuts |
| Debugging/analysis | evidence, ruled-out paths, remaining uncertainty | whether conclusions follow from evidence and old exclusions still hold |
| Docs/prose | source basis, claims intentionally avoided | accuracy, overclaiming, and missing context |

The forward-looking block should include what completed, what was not checked, any active items rolling forward, and a proposed next bundle. State the round-trip count when proposing slices, for example "trip two of a proposed three." Collapse slices into as few passes as you can live with; only true dependency defers.

## Derived Repair Records

If a helper reports orphaned specification members, run `repair-task-spec-log.md` immediately for that task, and surface the repair helper's `announcement` receipt field in your reply; this is required, not optional.

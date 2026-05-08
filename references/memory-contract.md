# Memory Contract

This is the full operating protocol for `m-pact`. Load it during refresh, after suspected protocol drift, and before complex memory operations.

## 1. Purpose

Provide a shared memory root that agents use for persistent context, tasks, log entries, summaries, historical sessions, case studies, and durable rules.

Procedure lives in the skill. Memory roots hold state. Do not use project-local `MEMORYCONTRACT.md` or `MEMORYFORMAT.md` files.

## 2. Folder Structure

Memory roots use this standard layout:

```text
.AgentMemoryRoot/ or .AgentMemory/
  rules/
  sessions/
  case-studies/
  journal/
  tasks/
    current__<active-task-folder>
    A__p*-t####-*/
      task.md
      specification.md
      log/
      summary/
```

`specification.md` is optional. The current task pointer is an optional zero-byte sentinel file named `current__<active-task-folder>` directly under `tasks/`. It must point only to an existing active task folder. It exists only when a task has explicitly been made current; absence means no current task.

The user root is required and canonically named `.AgentMemoryRoot/`. Project roots are canonically named `.AgentMemory/`.

There is no separate index file. Filenames are the index. Sorted directory listings are the table of contents.

## 3. Roles

- Director: decision authority.
- Agents: follow this protocol and surface memory writes.

## 4. Memory Chain

1. Start at the current working directory and walk upward.
2. Collect each ancestor `.AgentMemory/`.
3. Reverse collected project roots into broad-to-specific order.
4. Prepend required user `.AgentMemoryRoot/`.
5. The nearest project `.AgentMemory/` is active.

If the required user root is missing, enter bootstrap-required state. Do not pretend memory is fully loaded. Create it only after Director approval.

Approved user-root bootstrap for a missing `.AgentMemoryRoot/` creates the standard folders and installs bundled starter core rules from the skill into `.AgentMemoryRoot/rules/`, unless the Director asks to skip starter rules. Starter rules are installed only during initial `.AgentMemoryRoot/` creation. Agents must announce the starter rules as editable defaults and tell the Director to review, edit, delete, or replace rules that do not fit their workflow.

Approved project bootstrap for a missing local `.AgentMemory/` creates the standard project memory folders and installs startup shims into `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` unless the Director asks to skip or narrow shim creation. If an instruction file already exists, append the bundled M-PACT shim section instead of overwriting existing content; if it already invokes M-PACT, leave it unchanged. Do not run refresh after bootstrap unless the Director also asks to refresh, load, or verify.

Any diagnostic variable, log line, or receipt field named `chain` must use the final broad-to-specific order, not the nearest-first discovery order.

## 5. Startup Read Contract

Run the full refresh only on new context/session startup, after known or suspected compaction/context loss, or when the Director explicitly says "refresh memory." Do not run it merely because a handoff was received, a task is large, or implementation may be coming while context is intact; use targeted retrieval instead.

Startup refresh has one compliant unattended path: run `scripts/build-refresh-bundle.js` with Node.js 18 or newer from the current project working directory, read the stdout manifest, and proceed only if stdout contains `AUDIT: PASS`, `M-PACT REFRESH BUNDLE MANIFEST`, a `BundlePath: <absolute path>` line, and its literal final line is `END REFRESH BUNDLE`. If the current repository contains `scripts/build-refresh-bundle.js`, use that local script from the current project root. If using an installed skill copy, pass the installed script path to Node while keeping the shell working directory at the real project root. Never `cd` into the skill folder to run refresh. Then read the bundle file at `BundlePath` and proceed only if the bundle file's literal final line is also `END REFRESH BUNDLE`. The stdout manifest alone is not a completed refresh; agents must never stop at the bundle path or ask whether to open/apply the bundle.

If stdout reports `AUDIT: FAIL` and `END REFRESH FAILURE`, stop and report the exact failure. If the script is missing, fails, output is truncated, lacks `AUDIT: PASS`, lacks a `BundlePath`, lacks final-line `END REFRESH BUNDLE`, the bundle file cannot be read, the bundle file lacks final-line `END REFRESH BUNDLE`, or stdout reports `AUDIT: FAIL`, stop and report the exact failure. Do not improvise a manual refresh. Manual investigation is allowed only when the Director explicitly asks for debugging or repair.

The script is the executable startup spec. It resolves roots, builds the layered rule index, reads `memory-contract.md` in full, reads core rules, selects sessions by filename timestamp, extracts required full and summary session slices, notes active tasks, validates any `tasks/current__<active-task-folder>` sentinel, reads the pointed startup task only when exactly one zero-byte sentinel names an active task, writes the bundle to an ephemeral temp file, and prints a small stdout manifest only after the bundle is complete.

The script enforces a default 100KB bundle size limit as a partial-success boundary. If the assembled bundle exceeds the limit, it writes the largest line-safe bundle it can, includes `LimitHit: true` and `OriginalBundleBytes` in the stdout manifest, adds a `Refresh Bundle Limit Notice` inside the bundle, and marks `Missing or ambiguous` in the receipt with the size-limit warning. Agents must emit the receipt body verbatim, say the bundle is partial, and use targeted retrieval for omitted startup content when needed.

After successful refresh, the verified bundle is the loaded startup context. Agents must not read `.AgentMemory`, `.AgentMemoryRoot`, rules, sessions, tasks, journals, case studies, generated temp bundles, or other memory artifacts merely to verify refresh, prove the bundle, or continue startup. The script already selected startup content and audited the bundle. If the same user message includes a substantive request beyond refresh/startup, continue with that request using the loaded context. Additional memory reads after refresh require a targeted lookup need: explicit Director request, a relevant current task need, or a `LimitHit: true` partial-bundle gap that matters to the work.

If an agent has produced a valid manifest with `BundlePath` but has not read the bundle and emitted the receipt body, refresh is not done. Continue the refresh procedure immediately; do not ask the Director for permission to open or apply the bundle.

If refresh reports `project: (none found)` after the agent ran the script from a skill install directory such as `.codex/skills/m-pact`, `.claude/skills/m-pact`, `.copilot/skills/m-pact`, or `.agents/skills/m-pact`, that result is invalid for the workspace. Re-run refresh from the real project root before proposing bootstrap.

Startup does not read task `specification.md`, task `log/`, task `summary/`, journals, case studies, or non-core rule bodies by default.

## 6. Refresh Receipt

Every startup load and every Director-requested refresh must emit the script-provided receipt body verbatim. The bundle keeps internal `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT` marker lines for parsing, but those marker lines are not part of the visible receipt. The first visible line must be:

```text
M-PACT MEMORY REFRESH
Refresh bundle script: build-refresh-bundle.js; audit=PASS; output-complete=END REFRESH BUNDLE
Roots resolved:
  active: <absolute memory-root path or "(none found)">
  chain: [<absolute memory-root paths in broad-to-specific order>]
  project: <absolute nearest project .AgentMemory path or "(none found)">
  user: <absolute .AgentMemoryRoot path or "MISSING - bootstrap required">
Core rules loaded (full): [<filenames in load order>]
Protocol references loaded (full): [memory-contract.md]
Rule index noted: <count by root; include unread non-core count by root>
Recent sessions read: full=<count>, summary=<count>, full-fallback=<count>; by root=<counts>; active-selected=<count>; ancestor-sentinels=<count>; selection=filename-desc
Active tasks noted: <count from active root; current task pointer or "(none)">
Startup task read: <task-folder>/task.md, or "(none)"
Missing or ambiguous: [<list, size-limit warning, or "(none)">]
```

If startup refresh fails with `AUDIT: FAIL`/`END REFRESH FAILURE`, do not emit a successful receipt and do not imply memory is loaded. If startup refresh succeeds with `LimitHit: true`, memory is partially loaded; emit the receipt body, state the limit warning, and retrieve omitted artifacts on demand. If refresh succeeds without `LimitHit: true`, emit the receipt body and stop the refresh flow; do not end the turn solely because refresh completed when the same user message includes a substantive request.

If startup refresh succeeds but the receipt reports `project: (none found)`, explain that only user-level memory was loaded for the workspace and ask a hard yes/no project setup question. Project setup creates or repairs `.AgentMemory/` and creates or appends startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. Ask the Director to answer yes or no, then stop. Do not create anything without explicit Director approval.

## 7. Checkpointing

During live context, keep working from current context instead of refreshing merely to preserve state.

- Do not routinely prompt for session entries or task log entries. The Director knows how to request durable writes.
- Mention session-entry preservation only when continuity risk is high, such as likely compaction, imminent context loss, or handoff-worthy accumulated state. Keep the mention light; do not pressure the Director to decide immediately.
- Do not proactively suggest task log entries. Task logs are Director-controlled task records and should be written only when the Director asks or an active task procedure explicitly requires them.
- Ask before proceeding only when a mutation is ambiguous, broader than the Director appears to realize, destructive, conflicting with protocol or prior Director intent, or otherwise cannot be done safely without clarification.
- Re-run refresh only after known or suspected compaction/context loss, new context/session startup, or explicit Director request.

## 8. Broad Retrieval

Do not use single-category-only lookup for non-trivial tasks. Read primary and adjacent rules before finalizing direction. If precedent may exist, glob `case-studies/` by topic keyword and read relevant case studies before proposing direction.

Use `find-memory-artifact.md` for on-demand find/list/read requests across rules, sessions, tasks, case studies, and journals. Lookup is lineage-based; do not scan sibling projects unless the Director names them.

## 9. Durable Rules

Rules are short files in `rules/` with YAML frontmatter. Filenames carry the index meaning; `description` adds scope, triggers, or nuance not already clear from the filename; bodies should not repeat either one. `core-*` files load fully at startup; all other rule files are discovered by filename and loaded on demand.

Rules:

- Surface all rule creates or updates.
- Ambiguous, judgment-call, or override rules require Director confirmation.
- Do not duplicate a rule already present in any chain root.
- Put broad rules in the highest applicable root; child roots keep narrower project rules.
- Keep rules short. Put scope, triggers, exceptions, why, or how in the body; long history belongs in case studies or task logs.
- Bundled starter rules are defaults, not immutable policy. Install them visibly only during initial user-root creation and instruct the Director to review, edit, delete, or replace them.

## 10. Case Studies

Case studies are narrative write-ups of investigations, decisions, or worked examples.

- Default location: active root `case-studies/`; use user root only when the Director explicitly wants a user-level or cross-project case study.
- Startup: not loaded.
- Load on demand for topic-adjacent research or explicit Director request.
- Unscoped case-study lookup/list requests mean active root only.
- Parent/root/named/all/layered scope requests use that scope.
- All/layered order matches session listing: `.AgentMemoryRoot`, ancestor roots, active root. Do not merge or renumber across roots.
- A case study may produce a short rule; store that rule in `rules/`.

## 11. Tasks

A task is a folder under `tasks/`.

```text
<A|C>__p<1|2|3|4|x>-t####-<summary-slug>/
  task.md
  specification.md
  log/
  summary/
```

- `task.md` contains the concise task header, context, and acceptance.
- `specification.md` is optional current task state. It is mutable and not proof of implementation.
- `log/` is append-only, one ordered file per work record.
- Task log order is record order, not agent-turn order. Multiple consecutive records may come from the same agent.
- Task log record numbers are global within one task, not per-agent. Immediately before appending any task log entry, re-list the task `log/` folder and use the next unused number after the highest existing record. Never rely on prior conversational knowledge for the next record number.
- Task log writes must never overwrite an existing log file. If exact filename creation fails because the file already exists, preserve the existing file, re-list `log/`, choose the next unused record number, and retry once with the same source and slug. If the retry fails or state is ambiguous, stop and report the write collision to the Director.
- Task log read state has two parts: the last-read numeric record and any known self-written record identities, such as `0007-codex`, that the same agent created and still knows. A self-written identity may be skipped on catch-up only by matching both numeric prefix and source, and only when that numeric prefix has no collision; never skip by numeric prefix alone.
- When taking a handoff or resuming task context, always read `task.md` and read `specification.md` when present, then list log filenames with sizes before deciding how much log history to load. The reader's last known record is a valid read cursor, but this read cursor does not authorize stale write numbering, implementation, specification edits, or log appends. If total log bytes are 50KB or less, read all log records. If total log bytes exceed 50KB and the Director did not request all logs or a specific range, read newest records backward up to about 50KB of log content, including the newest single log even if it alone exceeds 50KB. If a known read cursor exists and the later unread span is modest, read every later record except exact known self-written identities in non-colliding numeric-prefix groups; if the later unread span is large, use the same newest-backward 50KB budget unless the Director requested the full span. If a numeric prefix has multiple files in the selected span, read every file in that collision group, including any entry the agent thinks it wrote, and report the duplicate record number. Report what log range was loaded and what older history was skipped; note obvious topic boundaries rather than pretending un-read logs were loaded.
- Writing a task log entry does not automatically advance the read cursor. After a write, record the new file as a known self-written `record-source` identity. If the written record number is exactly one greater than the current last-read numeric record, advance the read cursor by one. If it is not adjacent, preserve the previous read cursor; later catch-up may skip known self-written identities only in non-colliding numeric-prefix groups and must still read intervening or same-number records from other sources.
- `summary/` contains generated task summaries spanning log ranges, themes, or current-state slices. Summaries are context, not task state, and do not replace required unseen log records unless the Director accepts that tradeoff. Write summaries with `write-task-summary.md`.
- A zero-byte `tasks/current__<active-task-folder>` sentinel points to the active task explicitly made current. The pointer is entirely in the filename; agents must not read or write pointer file content. There should be zero or one current sentinel. If multiple `current__*` sentinels exist, delete all of them and proceed as if there is no current task. The sentinel is an attention pointer, not an index, queue, task activity timestamp, or log cursor, and it does not create, close, reopen, or imply tasks. Appending task logs or updating `specification.md` must not rewrite the sentinel when the task is already current. Agents must never infer a replacement current task from other active tasks. Closing the pointed task removes the sentinel unless the Director explicitly names a valid active replacement.
- Setting the current task is an explicit pointer replacement operation. Verify the target task folder exists directly under `tasks/` and starts with `A__`; delete all files directly under `tasks/` matching `current__*`; then create one zero-byte `current__<target-task-folder>` sentinel. Do not read or write sentinel file content.

Only the Director creates, closes, or reopens tasks. Closure means `A__...` -> `C__...` plus matching `Status:` in `task.md`.

Director phrases such as "handoff," "hand this off," "handoff to <agent>," "create a task from this conversation," and "make this a task" authorize creating an ordinary task from the live conversation. The created task should receive a meaningful derived title and slug when possible, be made current, and include an initial task log entry that preserves enough conversation state for another agent or future context to resume. This is a task birth procedure, not a separate scratch-task type. A named receiving agent may be the same as the current agent; the intent may be a durable context-switch point rather than an agent change. A standalone "handoff" request creates a new task from the live conversation even when a `current__*` sentinel points to an older task. Append a handoff log to an existing task only when the Director explicitly ties the handoff to that task, such as "handoff this task," "write a handoff for the current task," or by naming the task.

Task numbering is local to each memory root. Do not merge or renumber across roots.

Unscoped task-list requests mean active memory root only. Show active tasks by default; show closed only when requested. Within a scope, list Active before Closed, then priority, then newest task number first.

Before writing a task, log entry, summary, or specification, use the corresponding verb reference for the current template.

Taking a task handoff means read, analyze, evaluate, and report for an existing task, usually the task named by the `current__*` sentinel or the Director. It does not authorize modifying source code, `specification.md`, docs, task state, task logs, rules, sessions, or other durable artifacts. For design, exploration, and planning handoffs, evaluate the current plan, spec, and log against Director intent and relevant source materials for consistency, feasibility, ambiguity, missing constraints, and fit. For implementation handoffs, evaluate the implementation against the task, spec, log decisions, and relevant source behavior. Offer focused alternatives or recommendations when they directly serve the current goal, but do not push the Director to choose immediately.

## 12. Session Entries

Session entries are append-only concise summaries using the user's local time.

- Writes default to active root `sessions/`.
- Do not modify another agent's entry.
- Unscoped session-list requests mean active root only.
- Prefer task logs or summaries for single-task continuity.
- Use sessions for cross-task, project-wide, or ambiguous-scope notes.
- Write session entries only when the Director asks or clearly approves. Do not routinely prompt for them. A light preservation note is appropriate only when continuity risk is high; detailed handoff entries should include summary plus current state, open questions, and recent reasoning.
- New session entries must put startup-relevant continuity in `## Summary`. For cheap startup reads, every selected session after the newest active-root session is read only through `## Summary`; `## Context` and later sections are full-handoff detail for explicit or newest-session reads.

## 13. Journal Entries

`journal/` holds Director-authored, first-person, reflective entries. It is part of the standard root structure for both `.AgentMemoryRoot/` and `.AgentMemory/`.

Journal entries are not part of the core startup read contract. Use `write-journal-entry.md` only when the Director explicitly asks for it. Default to the active root unless the Director explicitly wants user-level or cross-project placement.

- Unscoped journal lookup/list requests mean active root only.
- Parent/root/named/all/layered scope requests use that scope.
- All/layered order matches session listing: `.AgentMemoryRoot`, ancestor roots, active root. Do not merge or renumber across roots.
- Journal entries are not prompts or task assignments.

## 14. Execution Contract

- Parse Director input into an explicit checklist before implementation.
- Restate interpreted intent when dictation artifacts are present.
- Continue autonomously through requested analysis, evaluation, review, and handoff reporting. Do not ask whether to perform implied read/analyze steps.
- Do not routinely prompt for session-entry checkpoints or task log entries.
- Surface durable memory create/update actions in the response.
- Mark blocked state explicitly when required protocol state is ambiguous.
- Never use polling in persistent-memory workflow.

## 15. Hard Prohibitions

- Never skip startup read contract.
- Never skip the Refresh Receipt after startup load or Director-requested refresh.
- Never treat log entries, summaries, or session entries as prompts, implementation directives, or action items.
- Never create durable memory silently.
- Never create ambiguous or judgment-call durable memory without Director confirmation.
- Never create, close, or reopen a task folder without explicit Director instruction.
- Never modify or delete another agent's log entry, summary entry, or session entry.
- Never rely on filesystem metadata timestamps for routine task ordering or listing. Use the `tasks/current__<active-task-folder>` sentinel, task numbers, and header timestamps; never use filesystem timestamps to infer a replacement current task.
- Never improvise when a protocol step is ambiguous. Ask one concise question.
- Never silently lose handoff-worthy state when context is getting low; mention preservation only when continuity risk is high.
- Never claim memory is loaded when it is not.

## 16. Authority Precedence

1. Director instruction
2. Active execution-plan docs
3. Agent config docs
4. Durable rules
5. Case studies
6. Task summaries
7. Task log entries
8. Session files

## 17. Violation Recovery

1. Stop side actions.
2. Re-read this contract.
3. Read the relevant verb/template reference if the violation involved file creation.
4. Determine correct state.
5. Resume from that state.
6. Emit a fresh Refresh Receipt when refresh was involved.
7. Write a recovery log entry inside the relevant task's `log/` folder, or a recovery session entry if the issue spans multiple tasks.

## 18. What Does Not Go In Agent Memory

- Code-derived structure already recoverable from the codebase.
- VCS history snapshots.
- Debug transcript noise.
- Duplicate config text already present in agent config docs.
- Ephemeral details with no cross-session value.
- Long narrative content that belongs in `case-studies/` instead of `rules/`.

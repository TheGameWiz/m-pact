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
  sessions.zip
  case-studies.zip
  journal.zip
  tasks/
    current__<active-task-folder>
    A__p*-t####-*/
      task.md
      specification.zip
      log.zip
      summary.zip
```

The layout above is the possible shape after use, not bootstrap output. Artifact folders and ZIP containers are lazy; missing categories mean empty categories unless a helper reports corruption. Task folders start with `task.md`, and task ZIP containers appear later on demand. The current task pointer is an optional zero-byte sentinel file named `current__<active-task-folder>` directly under `tasks/`; absence of `tasks/` or of the sentinel means no current task.

The user root is required and canonically named `.AgentMemoryRoot/`. Project roots are canonically named `.AgentMemory/`.

There is no separate index file. Filenames are the index. Sorted directory listings are the table of contents.

ZIP containers are helper-owned black boxes. Agents must not inspect, extract, mutate, or write ZIP files directly. Use `scripts/list-members.js`, `scripts/read-member.js`, `scripts/search-bodies.js`, `scripts/read-member-span.js`, and the append/write helpers so record numbering, operation locks, ZIP locks, and container validation remain consistent.

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

Approved global install creates or preserves `.AgentMemoryRoot/`, installs bundled starter core rules from the skill into `.AgentMemoryRoot/rules/` without overwriting existing rule files, syncs provider skill packages, and installs provider-global startup shims for configured runtimes. Approved user-root bootstrap outside install does the same user-root creation and starter-rule step, unless the Director asks to skip starter rules. Creating `rules/` is appropriate because rule files are being written; otherwise root artifact folders remain lazy. Starter rules are installed only during initial `.AgentMemoryRoot/` creation or when missing during install. Agents must announce the starter rules as editable defaults and tell the Director to review, edit, delete, or replace rules that do not fit their workflow.

Approved project bootstrap for a missing local `.AgentMemory/` uses `scripts/bootstrap-project.js` to create the root folder. Before project root creation, check for the user `.AgentMemoryRoot/`; if it is missing, perform global install with `scripts/install-mpact.js` first so provider skill packages, provider-global shims, starter rules, and `.AgentMemoryRoot/` exist. Project bootstrap does not install project startup shims or write project-local instruction files. Provider-global shims should invoke M-PACT for configured runtimes. Root artifact folders and ZIP containers are created later by the write operation that needs them. Do not run refresh after bootstrap unless the Director also asks to refresh, load, or verify.

Any diagnostic variable, log line, or receipt field named `chain` must use the final broad-to-specific order, not the nearest-first discovery order.

## 5. Startup Read Contract

Run the full refresh only on new context/session startup, after known or suspected compaction/context loss, or when the Director explicitly says "refresh memory." Do not run it merely because a handoff was received, a task is large, or implementation may be coming while context is intact; use targeted retrieval instead.

Startup refresh has one compliant unattended path: run the invoked skill or extension's `scripts/build-refresh-bundle.js` with Node.js 18 or newer while keeping the shell working directory at the real project root. Do not probe the current project's own `scripts/` directory as a fallback; unrelated projects often have unrelated scripts. Maintainers actively developing M-PACT may run the source-tree script intentionally for verification, but startup refresh instructions for agents should still point at the invoked skill or extension path. Never `cd` into the skill folder to run refresh.

If stdout contains `M-PACT PROJECT SETUP REQUIRED` and its literal final line is `END PROJECT SETUP REQUIRED`, stop before any receipt. No refresh bundle was generated, and user-root-only context has not been accepted by the Director. Ask the setup question from stdout. If the Director says yes, add the missing project scaffolding described in `references/bootstrap-project.md`, then run refresh again. If the Director says no, run refresh again with `--AllowUserRootOnly` and emit that user-root-only receipt.

If stdout contains `AUDIT: PASS`, `M-PACT REFRESH BUNDLE MANIFEST`, a `BundlePath: <absolute path>` line, and its literal final line is `END REFRESH BUNDLE`, read the bundle file at `BundlePath` and proceed only if the bundle file's literal final line is also `END REFRESH BUNDLE`. The stdout manifest alone is not a completed refresh; agents must never stop at the bundle path or ask whether to open/apply the bundle.

If the script fails, output is truncated, lacks one of the valid final markers (`END PROJECT SETUP REQUIRED` or `END REFRESH BUNDLE`), lacks `AUDIT: PASS` or `BundlePath` for a refresh bundle, cannot produce a readable bundle whose final line is `END REFRESH BUNDLE`, or reports `AUDIT: FAIL`/`END REFRESH FAILURE`, stop and report the exact failure. Do not improvise a manual refresh. Manual investigation is allowed only when the Director explicitly asks for debugging or repair.

The script is the executable startup spec. It resolves roots, treats missing lazy folders and ZIP containers as empty, builds the layered rule index, reads `startup-contract.md`, verifies whether the invoked skill already carries the matching startup-contract hash, lists core rule names without reading rule bodies, selects active-root sessions by filename timestamp, includes the newest session full or truncated plus up to four summaries under the recent-session budget, notes active tasks, validates any `tasks/current__<active-task-folder>` sentinel, reads the pointed startup task only when exactly one zero-byte sentinel names an active task, writes the complete bundle to an ephemeral temp file, and prints a small stdout manifest only after the bundle is complete.

The recent-session section is the startup budget boundary. The overall refresh bundle is always written as a complete, well-formed bundle; it is not truncated as a partial success path.

After successful refresh, the verified bundle is the loaded startup context. Agents must not read `.AgentMemory`, `.AgentMemoryRoot`, rules, sessions, tasks, journals, case studies, generated temp bundles, or other memory artifacts merely to verify refresh, prove the bundle, or continue startup. The script already selected startup content and audited the bundle. If the same user message includes a substantive request beyond refresh/startup, continue with that request using the loaded context. Additional memory reads after refresh require a targeted lookup need: explicit Director request, a relevant current task need, or a rule/session/task detail that matters to the work.

If an agent has produced a valid manifest with `BundlePath` but has not read the bundle and emitted the stdout receipt body, refresh is not done. Continue the refresh procedure immediately; do not ask the Director for permission to open or apply the bundle.

If refresh reports `project: (none found)` after the agent ran the script from a skill install directory such as `.codex/skills/m-pact`, `.claude/skills/m-pact`, `.copilot/skills/m-pact`, or `.agents/skills/m-pact`, that result is invalid for the workspace. Re-run refresh from the real project root before proposing bootstrap.

Startup does not read task specification snapshots, task `log.zip`, task `summary.zip`, journals, case studies, or non-core rule bodies by default.

## 6. Refresh Receipt

Every startup load and every Director-requested refresh must emit the script-provided compact stdout receipt body after verifying the bundle. Stdout and the bundle keep internal `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT` marker lines for parsing, but those marker lines are not part of the visible receipt. The full startup manifest remains loaded inside the verified bundle; do not print the full manifest merely to prove refresh. Normal successful refresh should be a tiny visible acknowledgement, not a startup report. The first visible lines must be:

```text
M-PACT MEMORY REFRESH
audit=PASS; bundle=loaded; output-complete=END REFRESH BUNDLE
```

If startup refresh fails with `AUDIT: FAIL`/`END REFRESH FAILURE`, do not emit a successful receipt and do not imply memory is loaded. If refresh succeeds, emit the compact receipt and stop the refresh flow; do not end the turn solely because refresh completed when the same user message includes a substantive request.

Normal startup refresh should not emit a receipt with `project: (none found)` unless the Director already answered no to project setup and the agent reran refresh with `--AllowUserRootOnly`. Without that flag, missing project root must produce `M-PACT PROJECT SETUP REQUIRED` before bundle generation. The setup question must say setup will add `.AgentMemory/`, that artifact folders and ZIP containers are created lazily when first used, and that project startup shims are not part of project bootstrap. Ask the Director to answer yes or no, then stop. Do not create anything without explicit Director approval.

## 7. Checkpointing

During live context, keep working from current context instead of refreshing merely to preserve state.

- Default user-visible confirmations for helper-backed writes should be short and task-level: say what changed, not how storage changed. Do not report internal paths, folder renames, ZIP member names, sentinel filenames, container names, or timestamps unless the Director asks for debugging details, the operation failed or was partial, ambiguity remains, or another immediate operation needs that internal value. The refresh receipt is the model for normal successful output: compact, clear, and complete enough.
- Helper scripts own storage placement, record/member numbering, current-task resolution, and ZIP/catalog mechanics. Agents must not list catalogs, inspect folders, or compute placement merely to call a write helper. Appending a task log does not require reading existing log entries; write from the current Director request, current conversation state, and live evidence. Read catalogs and prior records only for lookup, handoff/resume, summarization, explicit history questions, or when the Director explicitly asks to base new work on prior task history.
- Do not routinely prompt for session entries or task log entries. The Director knows how to request durable writes.
- Mention session-entry preservation only when continuity risk is high, such as likely compaction, imminent context loss, or handoff-worthy accumulated state. Keep the mention light; do not pressure the Director to decide immediately.
- Do not proactively suggest task log entries. Task logs are Director-controlled task records and should be written only when the Director asks or an active task procedure explicitly requires them.
- Ask before proceeding only when a mutation is ambiguous, broader than the Director appears to realize, destructive, conflicting with protocol or prior Director intent, or otherwise cannot be done safely without clarification.
- Re-run refresh only after known or suspected compaction/context loss, new context/session startup, or explicit Director request.

## 8. Broad Retrieval

Do not use single-category-only lookup for non-trivial tasks. Read primary and adjacent rules before finalizing direction. If precedent may exist, search `case-studies.zip` member names by topic keyword and read relevant case studies before proposing direction.

Use `find-memory-artifact.md` for on-demand find/list/read requests across rules, sessions, tasks, case studies, and journals. Lookup is lineage-based; do not scan sibling projects unless the Director names them.

## 9. Durable Rules

Rules are short files in `rules/` with YAML frontmatter. Filenames carry the index meaning; `description` adds scope, triggers, or nuance not already clear from the filename; bodies should not repeat either one. Startup lists core rule filenames only. Read any relevant rule body on demand before relying on it for direction, especially for primary or adjacent rules that may affect the current work.

Rules:

- Surface all rule creates or updates.
- Ambiguous, judgment-call, or override rules require Director confirmation.
- Do not duplicate a rule already present in any chain root.
- Put broad rules in the highest applicable root; child roots keep narrower project rules.
- Keep rules short. Put scope, triggers, exceptions, why, or how in the body; long history belongs in case studies or task logs.
- Rule writes must go through `write-rule.md` and `scripts/write-rule.js`. The helper owns timestamping, frontmatter formatting, filename length checks, lazy `rules/` folder creation, and the file write.
- Bundled starter rules are defaults, not immutable policy. Install them visibly only during initial user-root creation and instruct the Director to review, edit, delete, or replace them.

## 10. Case Studies

Case studies are narrative write-ups of investigations, decisions, or worked examples.

- Default location: active root `case-studies.zip`; use user root only when the Director explicitly wants a user-level or cross-project case study.
- Startup: not loaded.
- Load on demand for topic-adjacent research or explicit Director request.
- Unscoped case-study lookup/list requests mean active root only.
- Parent/root/named/all/layered scope requests use that scope.
- All/layered order matches session listing: `.AgentMemoryRoot`, ancestor roots, active root. Do not merge or renumber across roots.
- Write case studies with `write-case-study.md` and the case-study helper. A case study may produce a short rule; store that rule in `rules/`.

## 11. Tasks

A task is a folder under `tasks/`. `tasks/` is created only when the first task is created.

```text
<A|C>__p<1|2|3|4|x>-t####-<summary-slug>/
  task.md
  specification.zip
  log.zip
  summary.zip
```

- A newly-created task folder contains `task.md` only. Create `specification.zip`, `log.zip`, and `summary.zip` only when the corresponding helper writes the first member.
- `task.md` contains the concise task header, context, and acceptance. Task creation must go through `create-task.md` and `scripts/create-task.js`.
- `specification.zip` contains full numbered specification snapshots. The highest-numbered member is the current specification. Never edit an older specification member.
- `log.zip` is append-only, one ordered member per work record. It is created lazily when the first log entry is written.
- Task log order is record order, not agent-turn order. Multiple consecutive records may come from the same agent.
- Task log record numbers are global within one task, not per-agent. Agents must not assign record numbers manually.
- Task log writes must go through `write-task-log.md` and `scripts/write-task-log.js`.
- Task log read state is the last-read numeric record in the current conversation. M-PACT does not persist per-agent read cursors.
- When taking a handoff or resuming task context, use `scripts/prepare-handoff.js` to plan the read span from `task.md`, the current specification snapshot, `log.zip`, and `summary.zip`. Use `scripts/read-member-span.js --container task-log --after <record>` for direct cursor catch-up. A caller-supplied read cursor is valid only for planning reads; it does not authorize stale write numbering, implementation, specification writes, or log appends. Treat older loaded records as historical background when later records, the current specification snapshot, or the Director have superseded them.
- Writing a task log entry does not persist or automatically advance a read cursor.
- `summary.zip` contains generated task summaries spanning log ranges, themes, or current-state slices. It is created lazily when the first task summary is written. Summaries are context, not task state, and do not replace required unseen log records unless the Director accepts that tradeoff. Write summaries with `write-task-summary.md`.
- A zero-byte `tasks/current__<active-task-folder>` sentinel points to the active task explicitly made current. The pointer is entirely in the filename; agents must not read or write pointer file content. There should be zero or one current sentinel. If multiple `current__*` sentinels exist, report ambiguity, leave them in place, and proceed as if there is no current task until an explicit current-task repair clears or replaces them. The sentinel is an attention pointer, not an index, queue, task activity timestamp, or log cursor, and it does not create, close, reopen, or imply tasks. Appending task logs or writing specification snapshots must not rewrite the sentinel when the task is already current. Agents must never infer a replacement current task from other active tasks. Closing the pointed task removes the sentinel unless the Director explicitly names a valid active replacement.
- Setting the current task is an explicit pointer replacement operation through `set-current-task.md` and `scripts/set-current-task.js`.

Only the Director creates, closes, or reopens tasks. Closure means the task status changes to `Closed`; reopening changes it back to `Active`.

Director phrases such as "handoff," "hand this off," "handoff to <agent>," "create a task from this conversation," and "make this a task" authorize creating an ordinary task from the live conversation. The created task should receive a meaningful derived title and slug when possible, be made current, and include an initial task log entry that preserves enough conversation state for another agent or future context to resume. This is a task birth procedure, not a separate scratch-task type. A named receiving agent may be the same as the current agent; the intent may be a durable context-switch point rather than an agent change. A standalone "handoff" request creates a new task from the live conversation even when a `current__*` sentinel points to an older task. Write a handoff log to an existing task only when the Director explicitly ties the handoff to that task, such as "handoff this task," "write a handoff for the current task," or by naming the task.

Task numbering is local to each memory root. Do not merge or renumber across roots.

Unscoped task-list requests mean active memory root only. Show active tasks by default; show closed only when requested. Within a scope, list Active before Closed, then priority, then newest task number first.

Before writing a task, log entry, summary, or specification, use the corresponding verb reference for the current template.

Taking a task handoff means read, analyze, evaluate, and report for an existing task, usually the task named by the `current__*` sentinel or the Director. It does not authorize modifying source code, specification snapshots, docs, task state, task logs, rules, sessions, or other durable artifacts. A handoff response should not be summary-only unless the Director explicitly asks only for a summary. Evaluate the current handoff span as claims and direction to test: identify what changed, inspect relevant source/spec artifacts when needed, assess feasibility, risks, assumptions, and implementation issues, and recommend the best next path or rank alternatives when no single path is clearly best. For design, exploration, and planning handoffs, evaluate the current plan, spec, and log against Director intent and relevant source materials for consistency, feasibility, ambiguity, missing constraints, implementation risk, and fit. For implementation handoffs, evaluate the implementation against the task, spec, log decisions, and relevant source behavior. For specification-to-implementation handoffs, evaluate whether the spec is implementable, sufficiently constrained, aligned with the codebase, and likely to produce the desired behavior. Do not push the Director to choose immediately.

## 12. Session Entries

Session entries are append-only concise summaries using the user's local time.

- Writes default to active root `sessions.zip`.
- Do not modify another agent's entry.
- Unscoped session-list requests mean active root only.
- Prefer task logs or summaries for single-task continuity.
- Use sessions for cross-task, project-wide, or ambiguous-scope notes.
- Write session entries only when the Director asks or clearly approves. Do not routinely prompt for them. A light preservation note is appropriate only when continuity risk is high; detailed handoff entries should include summary plus current state, open questions, and recent reasoning.
- New session entries must put startup-relevant continuity in `## Summary`. For cheap startup reads, every selected session after the newest active-root session is read only through `## Summary`; `## Context` and later sections are full-handoff detail for explicit or newest-session reads.

## 13. Journal Entries

`journal.zip` holds Director-authored, first-person, reflective entries. It is created lazily on first journal write; if there are no journal entries, no `journal.zip` is required.

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
- For helper-owned writes, use direct helper arguments plus raw/plain stdin content. Do not create scratch input or fetch timestamps separately; see `helper-write-conventions.md`.
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
- Use helper scripts and `helper-write-conventions.md` for helper-owned memory writes.
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
7. Write a recovery log entry inside the relevant task's `log.zip`, or a recovery session entry if the issue spans multiple tasks.

## 18. What Does Not Go In Agent Memory

- Code-derived structure already recoverable from the codebase.
- VCS history snapshots.
- Debug transcript noise.
- Duplicate config text already present in agent config docs.
- Ephemeral details with no cross-session value.
- Long narrative content that belongs in `case-studies.zip` instead of `rules/`.

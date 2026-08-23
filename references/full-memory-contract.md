# Memory Contract

This is the full operating protocol for `m-pact`. Load it after suspected protocol drift, for violation recovery, and before complex memory operations.

Ownership rule: `SKILL.md` owns invocation, dispatch, and the startup fast path. `references/startup-contract.md` owns always-loaded protocol law. Each verb reference owns its operation's complete rules. This contract owns cross-cutting protocol with no other home, and for each operation keeps only a summary: its gate, its owning reference, the artifact it touches, and the likeliest mistake. Every operation summary here is orientation, not sufficient to act on: before performing an operation, read its owning reference.

## 1. Purpose

Provide a shared memory root that agents use for persistent context, tasks, log entries, historical sessions, case studies, and durable rules.

Procedure lives in the skill. Memory roots hold state. Do not use project-local `MEMORYCONTRACT.md` or `MEMORYFORMAT.md` files.

## 2. Folder Structure

Memory roots use this standard layout:

```text
.AgentMemoryRoot/ or .AgentMemory/
  project-count__<n>          # user root only
  project__<path-slug>        # project roots only
  rules/
  sessions.zip
  case-studies.zip
  .tmp/
    .gitignore
  journal.zip
  tasks/
    .m-pact-task-locks/
    current__<active-task-folder>
    A__p*-t####-*/
      task.md
      Agents.json
      specification.md
      specification.zip
      log.zip
```

The layout above is the possible shape after use, not bootstrap output. Artifact folders and ZIP containers are lazy; missing categories mean empty categories unless a helper reports corruption. `.tmp/` is helper-owned scratch for command-only body delivery and refresh bundles, not memory history. Task folders start with `task.md`; task ZIP containers, `Agents.json`, and the `specification.md` mirror appear later on demand. The current task pointer is an optional zero-byte sentinel named `current__<active-task-folder>` directly under `tasks/`; absence of `tasks/` or of the sentinel means no current task. `.m-pact-task-locks/` is helper-owned internal lock state keyed by stable task number, outside mutable task folders.

The user root is required and canonically named `.AgentMemoryRoot/`. Project roots are canonically named `.AgentMemory/`.

Project identity is helper-owned. The user root has exactly one zero-byte `project-count__<n>` counter sentinel holding the local high-water mark in its filename. Each project root has exactly one `project__<path-slug>` sentinel whose filename binds the identity to the resolved project root path and whose contents are the numeric project ID. Agents must not hand-edit, rename, or recreate identity sentinels. Existing pre-identity roots use lazy confirmed adoption: they are considered only when encountered by refresh or a durable write, and identity is minted only after the Director answers yes to `M-PACT PROJECT ADOPTION REQUIRED`. Use the repair helper when a helper reports a path-mismatched project identity.

There is no separate index file. Filenames are the index; sorted directory listings are the table of contents.

ZIP containers are helper-owned black boxes; the rule, the helper list, and the rationale are owned by `references/startup-contract.md`.

Task-local `Agents.json` is helper-owned provider transcript provenance, not a ZIP container and not narrative memory. It stores `{ "version": 1, "sessions": [...] }`, where each session entry has `provider`, `agent`, and opaque provider transcript lookup `id`. Entries are append-only in first-observed order and unique by `(provider, id)`; there are no first-seen, last-seen, or count fields. Missing `Agents.json` means zero recorded provider sessions. The six task mutation helpers (`create-task`, `write-task-log`, `write-design-spec`, `revise-task`, `close-task`, `reopen-task`), `set-current-task` on task-selection calls, and `prepare-handoff` for open tasks automatically record the current provider ID when their existing agent resolution identifies `claude`, `codex`, or `antigravity` and the matching provider environment variable is present: `CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID` with `CODEX_SESSION_ID` fallback, or `ANTIGRAVITY_CONVERSATION_ID`. `set-current-task --clear` and closed-task `prepare-handoff` lookups do not record. Agents do not pass a provider-session argument. `sessions.zip` remains project-wide narrative continuity; `Agents.json` is only a task-local trailhead for provider-maintained raw transcripts.

## 3. Roles

- Director: decision authority.
- Agents: follow this protocol and surface memory writes.

## 4. Memory Chain

1. Start at the current working directory and walk upward.
2. Collect each ancestor `.AgentMemory/`.
3. Reverse collected project roots into broad-to-specific order.
4. Prepend required user `.AgentMemoryRoot/`.
5. The nearest project `.AgentMemory/` is active.

For the startup user-root preflight rule, use `startup-contract.md`; refresh owns missing user-root detection and setup.

Runtime setup and bootstrap summaries:

- Provider runtime setup: Director-gated per the write gating in `startup-contract.md`; owner `references/install-mpact.md`; creates or preserves `.AgentMemoryRoot/` with scratch, identity counter, starter rules, and the provider-global shim; likeliest mistake: cross-installing the package into other provider roots, which the install helper never does.
- Project bootstrap: Director-approved only; owner `references/bootstrap-project.md`; creates `.AgentMemory/` with `.tmp/.gitignore` and a minted identity sentinel, nothing else; likeliest mistakes: installing project startup shims (bootstrap never writes them; startup belongs to provider-global shims) or refreshing afterward without a Director ask. If the user root is missing, runtime setup runs first so the shim, starter rules, counter, scratch, and `.AgentMemoryRoot/` exist. Starter rules are installed only during initial user-root creation or when missing during install, never overwriting existing rule files, and agents must announce them as editable defaults for the Director to review, edit, delete, or replace.

Any diagnostic variable, log line, or receipt field named `chain` must use the final broad-to-specific order, not the nearest-first discovery order.

## 5. Startup Read Contract

Refresh trigger policy, run mechanics, and post-refresh conduct are owned by `startup-contract.md`. Detailed halt and failure handling is owned by `references/refresh-memory.md`. This section covers the mechanics this contract alone records.

Startup refresh has one compliant unattended path: the invoked skill's `scripts/build-refresh-bundle.js`, per the run rules in `startup-contract.md`. Maintainers actively developing M-PACT may run the source-tree script intentionally for verification, but startup refresh instructions for agents should still point at the invoked skill path.

If stdout contains `M-PACT PROJECT SETUP REQUIRED` with literal final line `END PROJECT SETUP REQUIRED`, no refresh bundle was generated; follow the fast path's setup branch. If stdout contains `AUDIT: PASS`, `M-PACT REFRESH BUNDLE MANIFEST`, a `BundlePath:` line, and literal final line `END REFRESH BUNDLE`, read the bundle and proceed only if the bundle file's literal final line is also `END REFRESH BUNDLE`. The stdout manifest alone is not a completed refresh; never stop at the bundle path or ask whether to open or apply the bundle; refresh is not done until the bundle is read and the receipt body is emitted. Any other outcome is a failure: stop and report per `references/refresh-memory.md`; do not improvise a manual refresh. Manual investigation is allowed only when the Director explicitly asks for debugging or repair.

The script is the executable startup spec. It:

- resolves roots and treats missing lazy folders and ZIP containers as empty
- runs provider runtime setup mechanics when the required user root is incomplete
- reports missing active-project identity as `adoption-required` with a `M-PACT PROJECT ADOPTION REQUIRED` question
- initializes a missing counter when needed
- reports active-project identity status without repairing path mismatches
- builds the layered rule index
- reads and inlines `startup-contract.md`
- lists core rule names without reading rule bodies
- selects active-root sessions by filename timestamp
- includes only the newest session full or truncated under the recent-session budget
- notes active tasks with the current task first
- reports active task folders missing `task.md`
- reports orphaned specification companions for active tasks
- validates any `tasks/current__<active-task-folder>` sentinel
- reads the pointed startup task only when exactly one zero-byte sentinel names an active task
- restores a recent saved-context file for the resolved agent from the active root `.tmp`, or halts for a Director restore/discard decision when that file is older than the automatic threshold
- reports the resolved agent's task-log read-cursor and unread task-log records for the current task, and includes the agent's cursor record as orientation when one exists
- degrades instead of failing when the runtime identity cannot be resolved for saved-context restore
- writes the complete bundle to `.tmp` under the resolved active memory root, or under the user root when no project root is active
- prints a small stdout manifest only after the bundle is complete

The recent-session section is the startup budget boundary. The refresh bundle is always written complete and well-formed; it is not truncated as a partial success path.

After successful refresh, the verified bundle is the loaded startup context; continue any substantive request in the same message using it. Post-refresh reading conduct (no verification scans, no early unread-record reads) is owned by `startup-contract.md`.

If refresh reports `project: (none found)` after running from a skill install directory such as `.codex/skills/m-pact`, `.claude/skills/m-pact`, or `.gemini/config/skills/m-pact`, that result is invalid for the workspace; re-run from the real project root before proposing bootstrap.

Startup does not load design specifications, task logs, journals, case studies, or non-core rule bodies as context by default. It may inspect design specification and log catalogs, and legacy log frontmatter, to report orphaned specification companions.

## 6. Refresh Receipt

Every startup load and every Director-requested refresh must emit the script-provided receipt body exactly as printed between `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT`, after verifying the bundle. The marker lines themselves are not part of the visible receipt. The receipt may carry optional lines (saved context, provider setup, orphaned members) between its fixed lines; emit whatever the script printed, without reconstruction. The common minimal example:

```text
M-PACT MEMORY REFRESH
activeProjectRoot=<active-root>; projectId=<n>; projectIdentity=ok
audit=PASS; bundle=loaded; output-complete=END REFRESH BUNDLE
```

Normal successful refresh is a tiny visible acknowledgement, not a startup report; do not print the full manifest merely to prove refresh. If refresh fails, do not emit a successful receipt and do not imply memory is loaded. If refresh succeeds, emit the receipt and continue the turn; do not end it solely because refresh completed.

A `project: (none found)` receipt is valid only for an explicit user-root-only refresh request with `--AllowUserRootOnly`, or for a disallowed setup location where refresh reports `projectSetup=skipped-disallowed-location`. Without that flag or skip condition, a missing project root must produce `M-PACT PROJECT SETUP REQUIRED` before bundle generation; the question content is owned by `references/bootstrap-project.md`, and nothing is created without explicit Director approval. If the Director answers no to the setup question, say `M-PACT: no memory root here; refresh skipped` and stop rather than rerunning refresh.

`M-PACT PROJECT ADOPTION REQUIRED` alongside a successful receipt means memory is loaded but the active root is unadopted; the fast path owns the ask. Yes: adopt via `references/adopt-project-identity.md`, refresh again, use the new receipt ID. No: reads continue; durable writes keep halting.

## 7. Checkpointing

During live context, keep working from current context instead of refreshing merely to preserve state.

- Default user-visible confirmations for helper-backed writes are short and task-level: say what changed, not how storage changed. Project-write receipts include `projectPath` beside `projectId` so the Director can verify the target. Do not report other internal paths, member names, sentinel filenames, or timestamps unless the Director asks for debugging detail, the operation failed or was partial, ambiguity remains, or another immediate operation needs the value.
- Helper scripts own storage placement, record numbering, current-task resolution, and ZIP mechanics. Do not list catalogs, inspect folders, or compute placement merely to call a write helper; appending a task log does not require reading existing entries. Read catalogs and prior records only for lookup, handoff/resume, summarization, explicit history questions, or when the Director explicitly asks to base new work on prior history.
- Project-ID and `--cross-project` rules are owned by `startup-contract.md`. Never use `--cross-project` to bypass an identity refusal.
- Do not routinely prompt for, propose, or write session entries, task logs, or preservation handoffs; durable memory writes require explicit Director request or an active task procedure that explicitly calls for them. The Director knows how to request durable writes.
- Ask before proceeding only when a mutation is ambiguous, broader than the Director appears to realize, destructive, conflicting with protocol or prior Director intent, or otherwise unsafe without clarification.
- Re-run refresh only when `startup-contract.md` says a new refresh trigger exists.

## 8. Broad Retrieval

Do not use single-category-only lookup for non-trivial tasks. Read primary and adjacent rules before finalizing direction. If precedent may exist, search `case-studies.zip` member names by topic keyword and read relevant case studies before proposing direction.

Use `references/find-memory-artifact.md` for on-demand find/list/read requests across rules, sessions, tasks, case studies, and journals. Lookup is lineage-based; do not scan sibling projects unless the Director names them.

## 9. Durable Rules

Rules are short files in `rules/` with YAML frontmatter. Filenames carry the index meaning as level one of the rules (owner: `startup-contract.md`); `description` adds scope or triggers; bodies are the controlling detail, read on correlate.

- Rule writes: Director-gated for ambiguous, judgment-call, or override rules; owner `references/write-rule.md`; writes one file in `rules/`; likeliest mistakes: duplicating a rule already in a chain root instead of merging, or writing the file directly instead of through the helper.
- Surface all rule writes. Put broad rules in the highest applicable root; child roots keep narrower project rules. Long history belongs in case studies, not rule bodies.
- Bundled starter rules are defaults, not immutable policy.

## 10. Case Studies

Case studies are narrative write-ups of investigations, decisions, or worked examples. Not loaded at startup; read on demand for topic-adjacent research or explicit Director request.

- Case-study writes: Director-requested per the durable-write default; owner `references/write-case-study.md`; appends to the active root `case-studies.zip` (user root only on explicit Director want); likeliest mistake: minting a rule from every incident; extract a rule only when the case study reveals reusable behavior.
- Unscoped lookup means active root only; parent/root/named/all/layered scopes use that scope; all/layered order is `.AgentMemoryRoot`, ancestor roots, active root, never merged or renumbered across roots.

## 11. Tasks

A task is a folder under `tasks/`, created only when the first task is created. Folder-prefix state authority, retired `Status:`/`Owner:` fields, sentinel rules, and container formats are owned by `startup-contract.md`. Task numbering is local to each memory root; do not merge or renumber across roots. Unscoped task-list requests mean active root only: active tasks by default, closed only when requested; Active before Closed, then priority, then newest task number first.

Operation summaries (read the owner before acting):

- Operation verb grammar lives here so individual references do not maintain alias lists: `write` appends a record; `create` births a container; `revise` changes a definition; `modify` edits in place as the controlled exception; `save` snapshots state for restore; `set` moves a pointer. `Update` routes by target: task definitions use `revise-task`, rules use `write-rule --replace`, journal entries use `modify-journal-entry.js` only on explicit Director ask, and everything else uses an appended corrective record because append-only law makes in-place update the exception.
- Task creation: Director-gated; owner `references/create-task.md`; writes the `A__` folder and `task.md`; likeliest mistake: computing the task number or treating the creator as task authority; the helper assigns numbers and no role seats are created. Director phrases like "handoff", "hand this off", or "make this a task" birth an ordinary task from the live conversation; the phrase boundary is owned by `references/take-task-handoff.md`.
- Task revision: Director-gated; owner `references/revise-task.md`; rewrites `task.md` with a paired log; likeliest mistake: editing `task.md` directly.
- Review independence: owned by `references/take-task-handoff.md`; roles are retired descriptive metadata and helpers do not gate writes on seats.
- Design specification writes: Director-instructed; owner `references/write-design-spec.md`; writes `specification.zip` members plus a paired log, mirrored in `specification.md`; likeliest mistake: treating the mirror as a second source of truth or rerunning after a partial write without reading the projection status rules.
- Task log writes: owner `references/write-task-log.md`, which also owns active-item and Cleared/Resolved grammar; appends one `log.zip` record; likeliest mistakes: assigning record numbers manually or treating another agent's records as your own; never modify another agent's entry.
- Provider transcript path lookup: owner `references/list-agent-session-paths.md`; reads a task's `Agents.json` and resolves recorded IDs to provider transcript JSONL paths and stat metadata without reading transcript bodies; likeliest mistake: broad-scanning provider transcript roots before using the task-local ledger.
- Cross-scope session recall: owner `references/search-agent-sessions.md`; composes `list-agent-session-paths.js`, direct `tasks/` folder listing, and `<userRoot>/projects.json` to search prior conversations at task, project, or global scope; likeliest mistake: asking scope when the Director already stated it, or running an exhaustive multi-project sweep without confirming that every occurrence (not just the first) is wanted.
- Taking a handoff: a read/analyze/report operation that authorizes no mutation; owner `references/take-task-handoff.md`, including the `prepare-handoff.js` receipt fields and the evaluation standard (claims to test, not material to summarize; no summary-only responses); likeliest mistake: treating "take this handoff" as permission to implement.
- Set current task: explicit pointer replacement; owner `references/set-current-task.md`; replaces the `current__*` sentinel; likeliest mistake: inferring a replacement current task; never infer one, and log or spec writes must not move the sentinel.
- Close and reopen: Director-only; owners `references/close-task.md` and `references/reopen-task.md`; rename the folder prefix; likeliest mistake: closing or reopening on agent judgment, or assuming reopen restores the pre-close active-item list; it does not.
- Orphaned specification repair: announce, do not ask; owner `references/repair-task-spec-log.md`; appends a derived repair record; likeliest mistake: hand-authoring the missing rationale.
- Saved context: Director-invoked only; owner `references/context-save-restore.md`; writes one `saved-context-<agent>-<timestamp>.md` in root `.tmp`; likeliest mistake: volunteering a save because context feels long; it is not a task-log record and not a handoff.

Only the Director creates, closes, reopens, or revises tasks.

## 12. Session Entries

Session entries are append-only concise project-wide summaries in the user's local time; prefer task logs for single-task continuity.

- Session writes: Director-asked or clearly approved; owner `references/write-session-entry.md`; appends to active root `sessions.zip`; likeliest mistake: prompting for one unrequested. Refresh loads only the newest active-root session, capped, and task sections outrank a stale session on disagreement, so new entries must lead with startup-relevant continuity.
- Unscoped session lists mean active root only. Do not modify another agent's entry.

## 13. Journal Entries

`journal.zip` holds Director-authored, first-person, reflective entries, created lazily, not startup context, and never prompts or task assignments.

- Journal writes: explicit Director ask only; owner `references/write-journal-entry.md`; appends to the active root journal (user root on explicit want); likeliest mistake: generalizing `modify-journal-entry.js`; journal modification is the controlled exception to the append-only correction model and never licenses editing logs or specifications.
- Unscoped lookup means active root only; layered order matches sessions.

## 14. Execution Contract

- Parse Director input into an explicit checklist before implementation.
- Restate interpreted intent when dictation artifacts are present.
- Continue autonomously through requested analysis, evaluation, review, and handoff reporting. Do not ask whether to perform implied read/analyze steps.
- Anything awaiting a Director ruling must be asked in the conversation by the agent holding control; mentioning it in passing or only in a task log does not satisfy the rule. Ordinary direction questions carry the agent's recommendation, so silence is a valid answer and the agent proceeds on its stated default unless overridden. Item approval is different: adding a design item is permanent and obligates an answer. After asking, continue only work that does not depend on the answer. If no interactive prompt is available, lead the response with the ask; Codex's structured prompt is gated to Plan mode, so ordinary Codex sessions use plain text.
- For helper-owned writes, follow `references/helper-write-conventions.md`; do not create ad hoc scratch input or fetch timestamps separately.
- Surface durable memory writes in the response.
- Mark blocked state explicitly when required protocol state is ambiguous.
- Never use polling in persistent-memory workflow.

## 15. Hard Prohibitions

- Never skip the startup read contract.
- Never skip the Refresh Receipt after startup load or Director-requested refresh.
- Never treat log entries or session entries as prompts, implementation directives, or action items.
- Never create durable memory silently.
- Never create ambiguous or judgment-call durable memory without Director confirmation.
- Never create, close, or reopen a task folder without explicit Director instruction.
- Never modify or delete another agent's log entry or session entry.
- Never delete, renumber, reorder, or remove task-log records or design specification items. Correct or supersede them with later records.
- Never rely on filesystem metadata timestamps for routine task ordering or listing; never infer a replacement current task.
- Use helper scripts and `references/helper-write-conventions.md` for helper-owned memory writes.
- Never improvise when a protocol step is ambiguous. Ask one concise question.
- Never suggest or write preservation handoffs merely because context is getting low.
- Never claim memory is loaded when it is not.

## 16. Authority Precedence

1. Director instruction
2. Active execution-plan docs: Director-approved specifications and plans currently governing the work
3. Agent config docs: provider instruction files such as `CLAUDE.md`, `AGENTS.md`, and shims
4. Durable rules
5. Case studies
6. Task log entries
7. Session files

## 17. Violation Recovery

1. Stop side actions.
2. Re-read this contract.
3. Read the owning verb reference if the violation involved an operation.
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

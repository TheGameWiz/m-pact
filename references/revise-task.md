# Revise Task

Use only when the Director explicitly asks to change an existing task's title, priority, source, context, or acceptance. `revise-task` never creates a task; a missing task number is an error.

## Procedure

Use `scripts/revise-task.js`. The helper owns parsing `task.md`, refusing unmodelled fields, lazy normalization of retired fields, folder renames when title or priority changes, current-task sentinel repair after a rename, and the paired task-log write.

`task.md` is schema-bound and re-rendered: the helper round-trips the existing file, drops known retired fields (`Status`, `Owner`), and refuses an unknown field so content is not silently lost.

`Roles:` is retired task metadata. `revise-task` preserves legacy task files by removing retired fields during normal revisions; do not pass retired role metadata.

Context, acceptance, and the required paired log body may be supplied through one structured `--input` body:

```markdown
## Context
Revised context.

## Acceptance
Revised acceptance.

## Log
Why this task definition changed and what the next agent should know.
```

Structured `--input` sections follow `helper-write-conventions.md`; `## Log` is required.

`revise-task` validates the paired log body before mutating `task.md`. If mutation succeeds but the later ZIP append fails, it does not roll back: a retry converges because the preserved input re-applies the same idempotent task fields and `--task <number>` still resolves after a folder rename.

When the running provider exposes a transcript/session ID, the helper automatically records it in the task's `Agents.json` after resolving the agent identity. It reads `CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`/`CODEX_SESSION_ID`, or `ANTIGRAVITY_CONVERSATION_ID` as appropriate; agents do not pass a provider-session argument.

Example:

```bash
node <this-skill>/scripts/revise-task.js --task t0005 --project-id 7 --title "Updated task title" --agent codex --log-title "Task definition revised" --input "<helper-scratch-file>" --director-intent "Revise the existing task definition."
```

Do not edit `task.md` directly.

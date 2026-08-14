# Context Save And Restore

Use when the Director explicitly asks to save context before a manual compaction, clear, restart, or context-loss boundary, and then restore that context afterwards.

This is a Director-invoked exception to the preservation-write prohibitions. Agents must not volunteer it merely because context is long, compaction seems likely, or state feels handoff-worthy.

## Model

Context save writes one file for the resolved agent in the `.tmp` directory under the helper-resolved active memory root: the closest `.AgentMemory/.tmp` for project work, or `.AgentMemoryRoot/.tmp` when no project root is resolved. It is not OS temp, not a ZIP member, not a task-log record, and not tied to a task.

The filename is `saved-context-<agent>-<timestamp>.md`, where the timestamp is local time in `YYYYMMDD-HHMMSS`. The save helper deletes any existing saved context for that agent before writing the replacement. The body should put resume-critical state first: what was just verified, what was ruled out, files or commands in flight, risks, and the next intended action.

Saved context belongs to the same agent after context loss, not to a different agent taking a clean handoff. Task handoff remains a task-log operation.

## Accepted Phrases

These invocation aliases name the same operation; `save-context` is the canonical reference term:

- save context
- save my context
- save state before compaction
- restore context
- restore my context
- resume from saved context

## Save Procedure

1. Confirm the Director explicitly requested the save.
2. Write the saved context file with `scripts/save-context.js`.
3. Put resume-critical state first.
4. Do not include `## Active Items`; saved context is not an active-item handoff.

Example:

```bash
node <this-skill>/scripts/save-context.js --project-id 7 --agent codex
```

Use the project ID from the latest refresh or successful write receipt when the resolved root is a project `.AgentMemory`; user-root saves do not use a project ID. Supply only the save body; the helper writes the file in the resolved root `.tmp` directory. Ordinary installed helpers resolve the agent automatically; pass `--agent` only in the override cases enumerated in `startup-contract.md`.

Save-context requires no current task. Do not create a task, write a session entry, or select a task merely to save context.

## Restore Procedure

Restore rides the normal startup refresh: follow the `SKILL.md` Startup Fast Path, whose step 5 owns the `M-PACT SAVED CONTEXT DECISION REQUIRED` halt response. If refresh embeds a recent saved context in the bundle, treat that body as loaded startup context; the file has been consumed and deleted. When refresh halts and the Director has answered, rerun refresh with exactly one declaration printed by the helper:

- `--saved-context RESTORE:<filename>` to embed and consume it.
- `--saved-context DISCARD:<filename>` to delete it without embedding.

Refresh silently deletes older duplicate saved-context files for the current agent and continues with the newest. A saved context is never deleted by age alone. Age only decides whether refresh can restore automatically or must ask first.

A missing, wrong, stale, or unrecognized `--saved-context` declaration refuses. The filename is required on both restore and discard so one session cannot delete a newer saved context written while the Director was answering.

Do not create a task, write a handoff, update task state, or append a task log merely because restore happened.

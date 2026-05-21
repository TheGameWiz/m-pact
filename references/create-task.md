# Create Task

Use only after explicit Director instruction to create a task, or for standalone "handoff" / "make this a task" requests that preserve the live discussion as a new durable task.

## Target

Default target is the active project root. `tasks/` is lazy and is created by the helper when needed.

Treat standalone "handoff" as new task creation even when another task is current. Append to an existing task only when the Director names that task or says "handoff this/current task."

## Procedure

1. Derive a concise task title from the live discussion unless the Director supplied one.
2. Preserve enough resume state for another agent in the stdin body when this is a conversation-derived task.
3. Call `scripts/create-task.js` once with direct helper arguments plus raw/plain stdin body text when an initial log is needed.
4. Reply briefly with the created task number/name and that the next agent can take the current task handoff.

Example:

```bash
node scripts/create-task.js --root .AgentMemory --title "Short task title" --priority px --agent codex --log-title "Initial handoff"
```

The helper owns task numbering, folder naming, `task.md`, optional first `log.zip` member, timestamps, and current-task sentinel replacement. Do not calculate task numbers, create scratch input, or fetch timestamps separately; see `helper-write-conventions.md`.

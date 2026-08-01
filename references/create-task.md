# Create Task

Use only after explicit Director instruction to create a task, or for standalone "handoff" / "make this a task" requests that preserve the live discussion as a new durable task.

## Target

Default target is the active project root. `tasks/` is lazy and is created by the helper when needed.

Treat standalone "handoff" as new task creation even when another task is current. Append to an existing task only when the Director names that task or says "handoff this/current task."

## Procedure

The helper generates `task.md` with `# Task Entry`, timestamp/source/owner/priority/status metadata, `## Task`, and optional `## Context` / `## Acceptance` sections from flags. If an initial log body is supplied, the helper also generates the first task-log wrapper with YAML frontmatter, `# <log-title>`, and `## Agent Response: <agent>`. Supply only the initial log body that belongs under that generated task-log heading; do not reproduce the generated wrapper.

1. Derive a concise task title from the live discussion unless the Director supplied one.
2. Put stable task framing in `--context` and success conditions in `--acceptance` when known. Use the initial log body for conversation-derived resume state, decisions, caveats, and next steps that should not bloat `task.md`.
3. Call `scripts/create-task.js` once with direct helper arguments plus raw/plain stdin body text when an initial log is needed.
4. Reply briefly with the created task number/name and that the next agent can take the current task handoff.

Use `--director-intent` when the first log should preserve the Director-framed ask, for example "Create a task from the discussion about helper/reference drift." For body delivery, follow `helper-write-conventions.md`: use stdin only for short shell-simple text, and use OS-temp `--input <file>` for long or multi-line markdown.

Example:

```bash
node scripts/create-task.js --root .AgentMemory --project-id 7 --title "Short task title" --priority px --context "Why this task exists." --acceptance "What must be true when it is done." --agent codex --log-title "Initial handoff" --director-intent "Create a durable task from the current discussion."
```

Use the project ID from the latest refresh or successful write receipt. The helper owns task numbering, folder naming, `task.md`, optional first `log.zip` member, timestamps, project identity validation, and current-task sentinel replacement. Do not calculate task numbers, create project/skill scratch input, or fetch timestamps separately; see `helper-write-conventions.md`.

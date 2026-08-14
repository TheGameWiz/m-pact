# Create Task

Use only after explicit Director instruction to create a task, or for standalone "handoff" / "make this a task" requests that preserve the live discussion as a new durable task.

## Target

Default target is the active project root. `tasks/` is lazy and is created by the helper when needed.

Treat standalone "handoff" as new task creation even when another task is current. The full handoff-phrase disambiguation lives in `take-task-handoff.md`.

## Procedure

The helper generates `task.md` and, when an initial log body is supplied, the first task-log wrapper (YAML frontmatter, `# <log-title>`, `## Agent Response: <agent>`). Supply only the log body that belongs under that generated heading; do not reproduce the wrapper.

1. Derive a concise task title from the live discussion unless the Director supplied one.
2. Do not pass task roles. Roles are retired descriptive metadata and no longer gate task writes.
3. Put stable task framing in `--context` and success conditions in `--acceptance` when they are short and shell-simple.
4. For multi-line context, acceptance, or the initial log body, pass one structured `--input` body. Structured `--input` sections follow `helper-write-conventions.md`; `## Log` is optional here.
5. Call `scripts/create-task.js` once with direct helper arguments plus the structured/raw input only when needed.
6. Reply briefly with the created task number/name and that the next agent can take the current task handoff.

Use `--director-intent` when the first log should preserve the Director-framed ask, for example "Create a task from the discussion about helper/reference drift."

Example:

```bash
node <this-skill>/scripts/create-task.js --root .AgentMemory --project-id 7 --title "Short task title" --priority px --context "Why this task exists." --acceptance "What must be true when it is done." --agent codex --log-title "Initial handoff" --director-intent "Create a durable task from the current discussion."
```

Structured input example:

```bash
node <this-skill>/scripts/create-task.js --root .AgentMemory --project-id 7 --title "Short task title" --priority px --agent codex --log-title "Initial handoff" --director-intent "Create a durable task from the current discussion." --input "<helper-scratch-file>"
```

The helper scratch file body is:

```markdown
## Context
Why this task exists.

## Acceptance
What must be true when it is done.

## Log
Conversation-derived resume state, decisions, caveats, and next steps.
```

The helper owns task numbering, folder naming, `task.md`, optional first `log.zip` member, timestamps, project identity validation, and current-task sentinel replacement. Do not calculate task numbers.

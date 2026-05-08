# Create Task

Task creation is Director-orchestrated only. Use this reference only after explicit Director instruction to create or open a task.

Phrases such as "create a task from this conversation," "make this a task," "make a task out of this," "handoff," "hand this off," and "handoff to <agent>" are explicit task-creation instructions when the Director is asking to preserve the live discussion as durable task context. A bare "create a task" may need one concise clarification unless the current conversation has an obvious single topic.

Treat a standalone "handoff" request as new task creation from the current live conversation, even when a `tasks/current__<active-task-folder>` sentinel already points to an older task. Do not append to the existing current task merely because a pointer exists. Append a handoff log to an existing task only when the Director says "handoff this task," "write a handoff for the current task," "append a handoff log," names a task, or otherwise explicitly ties the handoff to an existing task.

## Target

Active project root: `.AgentMemory/tasks/`.

## Folder Name

`<A|C>__p<1|2|3|4|x>-t####-<summary-slug>/`

- `A` = active.
- `C` = closed.
- `p1` to `p4` = priority, `px` = unspecified.
- `t####` = next zero-padded task number in the active root.
- `summary-slug` = lowercase, hyphen-separated, descriptive.

Determine the next task number from existing task folder names. Do not use filesystem timestamps for routine ordering.

For conversation-derived tasks, derive a meaningful title and slug from the recent discussion. Use a generic slug such as `conversation-handoff` only when the topic is genuinely unclear.

## Folder Layout

```text
<task-folder>/
  task.md
  log/
  summary/
```

Create `specification.md` only when the new task has an approved current specification to store.

## Conversation-Derived Tasks

When the Director asks to create a task from the current conversation, use the recent discussion as source material and create an ordinary task. This is not a separate scratch-task type.

- Write `task.md` with the best current task statement, context, and provisional acceptance if known.
- Preserve enough state for another agent to resume in the first log entry, not in a required session entry.
- Include decisions, open questions, rejected or less likely alternatives when relevant, current reasoning, and recommended next move.
- Do not ask for a title by default. Derive one from the conversation and report the created task number and name.
- Create a session entry only when the Director separately asks or clearly approves broader session preservation.

For "handoff" requests, create the same ordinary task, make it current, and write the first log entry as a handoff to the next agent. If the Director names a receiving agent, address the handoff to that agent; otherwise write a general receiving-agent handoff. If the named agent is the current agent, still create the task; the Director may be asking for a durable context-switch point rather than an agent change. The final response should be brief: report the task number/name and say the next agent can take the current task handoff.

## task.md Template

Use `references/emit-local-timestamp.md` and the bundled timestamp helper once for the task creation. Put `BodyTimestamp` in the `task.md` `Timestamp:` field. Use the emitted field verbatim; do not reformat, recompute, or call the clock again for the same task creation.

```markdown
# Task Entry

Timestamp: YYYY-MM-DD HH:MM:SS <local-zone>
Source: director|claude|codex
Owner: director|claude|codex|shared
Priority: p1|p2|p3|p4|px
Status: Active|Closed

## Task
- One concise task statement.

## Context
(Optional.)

## Acceptance
(Optional.)
```

## Current Task Pointer

After creating an active task, make it current by creating a zero-byte sentinel directly under `tasks/`:

```text
tasks/current__<task-folder>
```

The sentinel filename is the pointer. It has no extension and no body; never write content into it. There must be zero or one `current__*` sentinel. When making a newly created task current, remove any prior current sentinel only as part of this explicit current-task change. The pointer must reference an existing active task folder in the same `tasks/` directory.

# Write Task Summary

Use when the Director asks to summarize a task, compress a long task log, create a handoff summary, or preserve current task state without changing `specification.md`.

## Authorization

Task summaries are durable task artifacts. Write one only when the Director asks, clearly approves, or a task procedure explicitly requires a generated summary.

Do not treat summarizing as permission to update `specification.md`, append a task log, edit source files, close the task, or mutate other artifacts.

## Target

Default target is the active task folder's `summary/` directory.

Identify the task folder from Director context, exactly one `tasks/current__<active-task-folder>` sentinel, or explicit task reference. Read `task.md` first. Read `specification.md`, relevant `log/` records, and existing summaries only as needed to create an accurate summary.

## Default Range

When the Director asks for a task summary without naming a range, write an incremental summary. Cover the first log record after the latest relevant task summary through the newest log record.

If no prior relevant summary exists, summarize from the first log record. If the Director asks for a complete, full, or from-beginning summary, cover the whole task history.

Use the latest relevant summary for the same kind of compression. Do not treat a thematic summary such as `open-questions` as the range boundary for a general current-state or handoff summary unless it actually covers that span.

## Filename

`YYYY-MM-DD-HHMMSS-<local-zone>-<agent>-<scope-slug>.md`

Use `references/emit-local-timestamp.md` and the bundled timestamp helper. Put `FilenameStamp` at the start of the filename and `BodyTimestamp` in the `Timestamp:` field. Use those fields verbatim; do not reformat, recompute, or call the clock again for the same summary.

Use a scope slug that says what the summary covers:

- `records-0001-0018`
- `ui-polish-current-state`
- `handoff-through-0032`
- `open-questions`

Never overwrite an existing summary file. If the target filename exists, choose a more specific slug or a new timestamp. Do not modify or delete another agent's summary entry.

## Procedure

1. Identify the task folder.
2. Read `task.md`.
3. Read `specification.md` when relevant.
4. Determine the summary range. If the Director did not name one, use the default incremental range from the first log record after the latest relevant summary through the newest log record.
5. Read the log range, theme, or current-state material being summarized. If summarizing after a known read cursor, include every relevant unseen record unless the Director accepts a summary-only tradeoff.
6. Read existing summaries only when needed to choose the incremental boundary or avoid duplicating or contradicting prior summaries.
7. Write one new summary file in `summary/`.
8. Report the summary path and the covered log range or theme.

## Template

```markdown
# Task Summary

Timestamp: YYYY-MM-DD HH:MM:SS <local-zone>
Agent: claude|codex
Scope: records 0001-0018 | current state | theme
Task: <task-folder-name>

## Summary
- Concise current-state summary future agents can use to decide what to read next.

## Covered Material
- Log records, specification sections, source files, or other artifacts summarized.

## Current State
- What is settled, what changed, and what remains true now.

## Open Questions
- Unresolved questions, risks, or decisions.

## Read Next
- Exact task logs, spec sections, source files, or summaries a future agent should read next if they need detail.
```

Task summaries are context. Never treat them as prompts, tasks, implementation directives, or proof of implementation.

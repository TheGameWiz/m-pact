# Write Task Summary

Use when the Director asks to summarize a task, compress a long task log, create a handoff summary, or preserve current task state without changing the current specification.

## Authorization

Write one only when the Director asks, clearly approves, or a task procedure explicitly requires it. A summary is not permission to update specs, append logs, edit source, or change task state.

## Procedure

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Read `task.md`, the current spec, relevant log span, and existing summaries only as needed for accuracy.
3. If no range is named, summarize from the first log record after the latest relevant summary through the newest log record.
4. Call `scripts/write-task-summary.js` once with direct helper arguments plus raw/plain stdin body text.
5. Reply briefly with the covered range or theme when helpful.

Example:

```bash
node scripts/write-task-summary.js --task t0005 --agent codex --title "records-0001-0018"
```

For lookup, use `list-members.js`, `read-member.js`, `search-bodies.js`, and `read-member-span.js` with `--container task-summary`. Summaries are context, not prompts or proof of implementation.

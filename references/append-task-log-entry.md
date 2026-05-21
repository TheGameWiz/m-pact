# Append Task Log Entry

Use when the Director asks to write a task log entry without changing the current specification, or when protocol requires a task-scoped checkpoint.

## Procedure

Use `scripts/append-task-log.js`. The helper owns record numbering, timestamps, member naming, task operation locking, ZIP locking, formatting, and duplicate refusal.

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Do not read existing `log.zip` entries merely to append. Write from the current request, conversation state, and evidence already gathered.
3. If the task has a current specification and the entry changes design state, provide either the paired specification member or an explicit no-spec-update-needed reason.
4. Call the helper once with direct arguments plus raw/plain stdin body text.
5. Reply briefly, e.g. `Logged the update for t0005.`

Example:

```bash
node scripts/append-task-log.js --task t0005 --agent codex --title "short descriptive title" --no-spec-update-needed-because "Review only."
```

Do not assign record numbers, update the current-task sentinel, create scratch input, or fetch timestamps separately. Lookup helpers are for handoff/resume, summarization, or explicit history questions, not normal append.

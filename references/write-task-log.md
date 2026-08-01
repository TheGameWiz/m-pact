# Write Task Log

Use when the Director asks to write a task log entry without changing the current specification, or when protocol requires a task-scoped checkpoint.

## Procedure

Use `scripts/write-task-log.js`. The helper owns record numbering, timestamps, member naming, task operation locking, ZIP locking, and formatting.

The helper generates YAML frontmatter, `# <title>`, and `## Agent Response: <agent>`. Supply only the body that belongs under `## Agent Response: <agent>`; do not reproduce that generated heading. Use `--director-intent` when a concise Director-framed ask would help future readers, for example the actual request or reason for the log in the Director's terms.

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Do not read existing `log.zip` entries merely to write the next log. Write from the current request, conversation state, and evidence already gathered.
3. If the task has a current specification and the entry changes design state, provide either the paired specification member or an explicit no-spec-update-needed reason.
4. Call the helper once with direct arguments plus raw/plain stdin body text.
5. Reply briefly, e.g. `Logged the update for t0005.`

For body delivery, follow `helper-write-conventions.md`: use stdin only for short shell-simple text, and use OS-temp `--input <file>` for long or multi-line markdown.

Example:

```bash
node scripts/write-task-log.js --task t0005 --project-id 7 --agent codex --title "short descriptive title" --no-spec-update-needed-because "Review only." --director-intent "Record the review outcome for the current task."
```

Use the project ID from the latest refresh or successful write receipt. Do not assign record numbers, update the current-task sentinel, create project/skill scratch input, or fetch timestamps separately. Lookup helpers are for handoff/resume, summarization, or explicit history questions, not normal writes.

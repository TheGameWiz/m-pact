# Append Task Log Entry

Use when the Director asks to write a task log entry without changing `specification.md`, or when protocol requires a task-scoped checkpoint.

## Procedure

1. Identify the task folder from Director context, `tasks/current-task.md`, or explicit task reference.
2. Read the task's `task.md`.
3. Read only the task artifacts needed to write an accurate checkpoint. When catching up from a last-read cursor, read every later record except known self-written identities matched by numeric prefix plus source, such as `0007-codex`, in non-colliding numeric-prefix groups; never skip by numeric prefix alone. If a numeric prefix has multiple files, read every file in that collision group and report the duplicate record number.
4. Immediately before writing, re-list existing files in `log/` and determine the next record number from the highest existing record number. Do not rely on prior conversational knowledge or a stale directory listing.
5. Write one new log file in `log/` with no-overwrite semantics.
6. If exact filename creation fails because the file already exists, preserve the existing file, re-list `log/`, choose the next unused record number, and retry once with the same source and slug. If the retry fails or state is ambiguous, stop and report the write collision to the Director.
7. Treat the new file as a known self-written record identity (`record-source`), not automatically as a new read cursor. If the written record number is exactly one greater than the current last-read numeric record, advance the read cursor by one. Otherwise preserve the previous read cursor.
8. Update `tasks/current-task.md` to point at this task.
9. Report the new log path.

## Filename

`<4-digit-record-number>-<source>-<descriptive-slug>.md`

Record numbers are global within one task log, not per-agent. Use the next unused number after the highest existing record. If a collision already exists, preserve the existing files and use the next unused number; do not create another colliding record. Never overwrite an existing log file.

For catch-up reads, an agent may skip a log entry it wrote itself by matching the numeric prefix and source together, for example `0007-codex`, only when that numeric prefix has no collision. Do not skip all files with record `0007`; if multiple `0007-*` files exist, read every file in that collision group, including any entry the agent thinks it wrote, and report the duplicate record number.

Examples:
- `0001-codex-initial-task-setup.md`
- `0002-claude-spec-v1-handoff.md`
- `0003-director-scope-decision.md`

## Template

```markdown
---
record: 0001
timestamp: YYYY-MM-DD HH:MM:SS <local-zone>
agents: [codex]
director_intent: Brief interpreted intent, or "(none)"
source_input: optional
files_involved: []
decisions: []
tool_evidence: []
---

# Descriptive Title

## Agent Response: codex

### Part 1 -- Interpretation

Brief restatement of what was asked or what this record is preserving.

### Part 2 -- Contribution

The substantive analysis, recommendation, decision, implementation report, or handoff.
```

The task log is append-only. Do not modify or delete another entry.

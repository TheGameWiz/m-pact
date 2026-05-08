# Update Task Specification And Append Log

Use when the Director says to update the spec, fold decisions into the spec, or write the next spec/log update.

## Authorization

Requires Director instruction. Do not autonomously update `specification.md`.

## Procedure

1. Identify the active task folder from Director context, `tasks/current-task.md`, or explicit task reference.
2. Read the task's `task.md`.
3. Read current `specification.md` if present.
4. Read the relevant ordered `log/` span needed to understand the approved change. Include every record since your last known read point when known, except known self-written identities matched by numeric prefix plus source such as `0007-codex` in non-colliding numeric-prefix groups; never skip by numeric prefix alone. If a numeric prefix has multiple files, read every file in that collision group and report the duplicate record number. Otherwise read enough recent or unsummarized log history to reconstruct current state. Multiple consecutive records from the same agent are normal.
5. Identify the exact current-state changes the Director approved.
6. Update root-level `specification.md` in place so it reflects the current refined state. Create it only when a spec is now intended to exist.
7. Immediately before appending, re-list existing files in `log/` and choose the next record number from the highest existing record number. Do not rely on prior conversational knowledge or a stale directory listing.
8. Append one new file in `log/` explaining what changed and why, using no-overwrite semantics.
9. If exact filename creation fails because the file already exists, preserve the existing file, re-list `log/`, choose the next unused record number, and retry once with the same source and slug. If the retry fails or state is ambiguous, stop and report the write collision to the Director.
10. Treat the new file as a known self-written record identity (`record-source`), not automatically as a new read cursor. If the written record number is exactly one greater than the current last-read numeric record, advance the read cursor by one. Otherwise preserve the previous read cursor.
11. Update `tasks/current-task.md` to point at this task.
12. Report the task folder, specification path, and new log entry file.

## Log Filename

`<4-digit-record-number>-<source>-<descriptive-slug>.md`

Take the highest existing record number in `log/` and increment. Record order is append/order-of-record, not agent-turn order. Record numbers are global within one task log, not per-agent. If a collision already exists, preserve the existing files and use the next unused number; do not create another colliding record. Never overwrite an existing log file.

For catch-up reads, an agent may skip a log entry it wrote itself by matching the numeric prefix and source together, for example `0007-codex`, only when that numeric prefix has no collision. Do not skip all files with record `0007`; if multiple `0007-*` files exist, read every file in that collision group, including any entry the agent thinks it wrote, and report the duplicate record number.

## Log Template

Use `references/emit-local-timestamp.md` and the bundled timestamp helper once before appending the log and updating the task pointer. Put `BodyTimestamp` in the log `timestamp:` field and any `updated:` field written during the same operation. Use the emitted field verbatim; do not reformat, recompute, or call the clock again for the same update.

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

# Write Session Entry

Use when a cross-task or project-wide checkpoint is required, or when the Director asks to document state outside a single task. Prefer task logs for single-task continuity.

## Approval

Write a session only when the Director explicitly asks for one. Do not suggest, mention, or write session preservation merely because continuity risk is high, compaction may be likely, or handoff-worthy state has accumulated.

## Target

Default target is active root `sessions.zip`. The container is lazy.

## Procedure

The helper generates `# Session Entry`, `Timestamp:`, `Agent:`, `Type:`, and `## Summary`. Supply only the body that belongs under `## Summary`; do not reproduce those generated lines.

Detailed entries are the default. Write enough for another agent, or the same agent after context loss, to resume without replaying the conversation: current state, decisions made and why, evidence checked, files touched, risks and open questions, and the next move.

1. Lead with resume-critical continuity in the opening paragraph under `## Summary`.
2. Include detailed sections inside the supplied body when useful. Refresh reads the newest active-root session in full, capped at 25KB, so multi-section entries are safe.
3. Call `scripts/write-session-entry.js` once with direct helper arguments plus raw/plain body text.

For body delivery, follow `helper-write-conventions.md`: use stdin only for short shell-simple text, and use OS-temp `--input <file>` for long or multi-line markdown.

Example:

```bash
node scripts/write-session-entry.js --root .AgentMemory --project-id 7 --agent codex --type handoff --title "short session cue"
```

Use the project ID from the latest refresh or successful write receipt for project-root writes. For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container sessions`; read helpers do not need project ID. Session entries are context, not prompts or tasks.

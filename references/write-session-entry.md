# Write Session Entry

Use when a cross-task or project-wide note, snapshot, or significant event should be remembered, or when the Director asks to document state outside a single task. Prefer task logs for single-task continuity, and use `save-context.js` for same-agent compaction or restart continuity.

## Approval

Director-request only: per `startup-contract.md`, do not write or propose session preservation unprompted.

## Target

Default target is active root `sessions.zip`.

## Procedure

The helper generates `# Session Entry`, `Timestamp:`, `Agent:`, `Type:`, and `## Summary`. Supply only the body that belongs under `## Summary`; do not reproduce those generated lines.

Detailed entries are the default. Write enough for a future reader to understand the project-wide state or event without replaying the conversation: decisions made and why, evidence checked, files touched when relevant, risks and open questions, and the next useful move.

1. Lead with the most startup-relevant project continuity in the opening paragraph under `## Summary`.
2. Include detailed sections inside the supplied body when useful. Refresh reads the newest active-root session in full, capped at 25KB, as a point-in-time project note that may be stale; task sections and the current-task sentinel are authoritative when they disagree with a session entry.
3. Call `scripts/write-session-entry.js` once with direct helper arguments plus raw/plain body text, following `helper-write-conventions.md` for body delivery.

Example:

```bash
node <this-skill>/scripts/write-session-entry.js --root .AgentMemory --project-id 7 --agent codex --type handoff --title "short session cue"
```

For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container sessions`; read helpers do not need project ID.

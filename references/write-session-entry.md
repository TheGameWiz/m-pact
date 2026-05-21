# Write Session Entry

Use when a cross-task or project-wide checkpoint is required, or when the Director asks to document state outside a single task. Prefer task logs or summaries for single-task continuity.

## Approval

Write a session only when the Director asks or clearly approves. Mention preservation only when continuity risk is high, such as likely compaction or handoff-worthy accumulated state.

## Target

Default target is active root `sessions.zip`. The container is lazy.

## Procedure

1. Put startup-relevant continuity in `## Summary`.
2. Put detail, caveats, current state, and read-next pointers in later sections when needed.
3. Call `scripts/write-session-entry.js` once with direct helper arguments plus raw/plain stdin summary text.

Example:

```bash
node scripts/write-session-entry.js --root .AgentMemory --agent codex --type handoff --title "short session cue"
```

For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container sessions`. Session entries are context, not prompts or tasks.

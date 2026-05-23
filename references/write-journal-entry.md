# Write Journal Entry

Use only when the Director explicitly asks for a journal entry or reflective note. Journal entries are not startup context and are not prompts.

## Target

Default target is active root `journal.zip`. Use user root only when the Director explicitly wants a user-level or cross-project journal entry. The container is lazy.

## Procedure

1. Write in Director voice: first-person, reflective, useful to a future reader.
2. Include project/phase/key-insight arguments only when useful.
3. Call `scripts/write-journal-entry.js` once with direct helper arguments plus raw/plain stdin body text.

If stdin body delivery fails, follow the fallback in `helper-write-conventions.md`.

Example:

```bash
node scripts/write-journal-entry.js --root .AgentMemory --title "Short journal cue"
```

For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container journal`. Use `modify-journal-entry.js` only for controlled modification. Do not proactively suggest journaling.

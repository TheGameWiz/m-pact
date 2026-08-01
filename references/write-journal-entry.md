# Write Journal Entry

Use only when the Director explicitly asks for a journal entry or reflective note. Journal entries are not startup context and are not prompts.

## Target

Default target is active root `journal.zip`. Project-root journal writes are identity-checked like other durable project writes. Use user root only when the Director explicitly wants a user-level or cross-project journal entry. The container is lazy.

## Procedure

The helper generates `# <title>`, `Project:`, optional `Phase:`, `Date:`, and `Author: director`. Supply only the journal body that belongs after that metadata; do not reproduce the generated title or metadata. Use `--key-insight` only when a short final takeaway is useful.

1. Write in Director voice: first-person, reflective, useful to a future reader.
2. Include project/phase/key-insight arguments only when useful.
3. Call `scripts/write-journal-entry.js` once with direct helper arguments plus raw/plain stdin body text.

For body delivery, follow `helper-write-conventions.md`: use stdin only for short shell-simple text, and use OS-temp `--input <file>` for long or multi-line markdown.

Example:

```bash
node scripts/write-journal-entry.js --root .AgentMemory --project-id 7 --title "Short journal cue"
```

Use the project ID from the latest refresh or successful write receipt for project-root writes. For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container journal`; read helpers do not need project ID. Use `modify-journal-entry.js` only for controlled modification. Do not proactively suggest journaling.

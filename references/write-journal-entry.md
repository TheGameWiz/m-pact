# Write Journal Entry

Use only when the Director explicitly asks for a journal entry or reflective note; per `startup-contract.md`, do not propose journaling unprompted. Journal entries are not startup context and are not prompts.

## Target

Default target is active root `journal.zip`. Use user root only when the Director explicitly wants a user-level or cross-project journal entry.

## Procedure

The helper generates `# <title>`, `Project:`, optional `Phase:`, `Date:`, and `Author: director`. Supply only the journal body that belongs after that metadata; do not reproduce the generated title or metadata. Use `--key-insight` only when a short final takeaway is useful.

1. Write in Director voice: first-person, reflective, useful to a future reader.
2. Include project/phase/key-insight arguments only when useful.
3. Call `scripts/write-journal-entry.js` once with direct helper arguments plus raw/plain body content using `helper-write-conventions.md`.

Example:

```bash
node <this-skill>/scripts/write-journal-entry.js --root .AgentMemory --project-id 7 --title "Short journal cue"
```

For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container journal`; read helpers do not need project ID. Use `modify-journal-entry.js` only when the Director explicitly asks to modify an existing journal entry; journal entries are the controlled exception to the ordinary append-only correction model for task logs and design specifications.

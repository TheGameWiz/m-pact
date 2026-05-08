# Write Rule

Use when the Director asks to add or update a durable rule, or when a significant unambiguous rule must be captured.

## Target

Default target is the active project root `rules/`. Write to `.AgentMemoryRoot/rules/` only when the Director explicitly wants a user-level/global rule.

## Approval

Ambiguous or judgment-call rules require Director confirmation before writing.

## Procedure

1. List rule filenames first: glob `rules/*.md` in each chain root, broad-to-specific. Filenames are the index; there is no separate rule index file.
2. Check for duplicate, overlap, or conflict by filename and topic before writing.
3. If overlap exists, read the candidate file and merge/update instead of creating a duplicate.
4. If conflict exists, ask the Director to resolve precedence.
5. Choose a filename that is useful as a standalone rule cue in startup receipts, directory listings, and search results.
6. Write compact rule wording using the template. Put the rule's core action in the filename; use `description` only for additive scope, triggers, or nuance not already clear from the filename.
7. Re-read the draft before finishing and remove frontmatter or body text that merely restates the filename or `description`.
8. Surface the new or updated rule in the response.

## Filename

`<category>-<topic-slug>.md`

Use one category only: `core-`, `behavior-`, `format-`, `director-`, `user-`, or a project prefix. The full filename including `.md` must be 96 characters or fewer.

The filename should be mostly the rule: descriptive enough that a directory listing communicates the rule's purpose without opening the file. Prefer `core-authorize-before-action-then-drive-forward.md` over generic names like `core-behavior-rules.md`.

## Template

Use `references/emit-local-timestamp.md` and the bundled timestamp helper when creating a new rule. Put `Date` in the `created:` field. Use that field verbatim; do not reformat, recompute, or call the clock again for the same rule.

```markdown
---
description: One sentence of additive clarification, instruction, scope, trigger, or nuance beyond the filename.
type: behavior
source: director
created: YYYY-MM-DD
---

Body extends the filename and `description`; do not restate them.

**Why:** One sentence max.

**How to apply:** Compact trigger/action guidance. Put long history or examples in `case-studies/`.
```

# Write Rule

Use when the Director asks to add or update a durable rule, or when a significant unambiguous rule must be captured.

## Target

Default target is the active project root `rules/`. Write to `.AgentMemoryRoot/rules/` only when the Director explicitly wants a user-level/global rule. `rules/` is lazy.

## Approval

Ambiguous, judgment-call, overlapping, or conflicting rules require Director confirmation before writing.

## Procedure

1. List rule filenames across the selected chain roots; filenames are the index.
2. Read only plausible overlaps or conflicts.
3. Merge/update instead of duplicating when an existing rule covers the topic.
4. Call `scripts/write-rule.js` once with direct helper arguments plus raw/plain stdin body text.
5. Surface the new or updated rule briefly.

Example:

```bash
node scripts/write-rule.js --root .AgentMemory --filename behavior-short-rule-cue.md --description "Additive scope or trigger sentence."
```

The helper owns timestamping, frontmatter, filename checks, `rules/` creation, and the write. Keep the body compact: apply guidance plus why; long history belongs in `case-studies.zip`.

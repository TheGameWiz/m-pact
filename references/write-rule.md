# Write Rule

Use for durable rule writes, including significant unambiguous rules that must be captured.

## Target

Default target is the active project root `rules/`. Write to `.AgentMemoryRoot/rules/` only when the Director explicitly wants a user-level/global rule.

## Approval

Ambiguous, judgment-call, overlapping, or conflicting rules require Director confirmation before writing. When in doubt whether a rule is unambiguous, it is ambiguous; ask.

## Procedure

1. List rule filenames across the selected chain roots; filenames are the index.
2. Read only plausible overlaps or conflicts.
3. Merge into the existing rule instead of duplicating when it already covers the topic.
4. Call `scripts/write-rule.js` once with direct helper arguments plus raw/plain body content using `helper-write-conventions.md`.
5. Surface the written rule briefly.

A new rule's filename must be a self-standing imperative: the index lists filenames as level one of the rules, in force as stated, so a filename that cannot stand alone is a broken rule.

Example:

```bash
node <this-skill>/scripts/write-rule.js --root .AgentMemory --project-id 7 --filename behavior-short-rule-cue.md --description "Additive scope or trigger sentence."
```

User-root/global rule writes do not use project ID. The helper owns filename checks, `rules/` creation, and identity validation. Keep the body compact: apply guidance plus why; long history belongs in `case-studies.zip`.

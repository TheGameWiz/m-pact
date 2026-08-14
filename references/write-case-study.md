# Write Case Study

Use when an incident, investigation, decision, or worked example needs a narrative record richer than a rule or session entry.

## Authorization

Case-study writes are durable project writes: the Director-request default of `startup-contract.md`'s write gating applies.

## Target

Default target is active root `case-studies.zip`. Use user root only when the Director explicitly wants a user-level or cross-project case study.

## Procedure

The helper generates frontmatter and `# <title>`. Supply only the narrative body that belongs under that title; do not reproduce the generated title or frontmatter.

1. Use case studies for explanatory narrative: context, what changed, root cause, fix, and lesson.
2. Extract a short rule separately only when the case study reveals reusable behavior.
3. Call `scripts/write-case-study.js` once with direct helper arguments plus raw/plain body content using `helper-write-conventions.md`.

Example:

```bash
node <this-skill>/scripts/write-case-study.js --root .AgentMemory --project-id 7 --title "Short descriptive title" --topic "area-tag"
```

For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container case-studies`; read helpers do not need project ID. Do not read case studies at startup; load them on demand for topic-adjacent research.

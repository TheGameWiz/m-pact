# Write Case Study

Use when an incident, investigation, decision, or worked example needs a narrative record richer than a rule or session entry.

## Target

Default target is active root `case-studies.zip`. Use user root only when the Director explicitly wants a user-level or cross-project case study. The container is lazy.

## Procedure

1. Use case studies for explanatory narrative: context, what changed, root cause, fix, and lesson.
2. Extract a short rule separately only when the case study reveals reusable behavior.
3. Call `scripts/write-case-study.js` once with direct helper arguments plus raw/plain stdin body text.

Example:

```bash
node scripts/write-case-study.js --root .AgentMemory --title "Short descriptive title" --topic "area-tag"
```

For lookup, use `list-members.js`, `read-member.js`, and `search-bodies.js` with `--container case-studies`. Do not read case studies at startup; load them on demand for topic-adjacent research.

# Write Case Study

Use when an incident, investigation, decision, or worked example needs a narrative record that is richer than a rule or session entry.

## Target

Default target is the active root `case-studies/`. Use `.AgentMemoryRoot/case-studies/` only when the Director explicitly wants a user-level or cross-project case study.

Do not read case studies at startup. Load them on demand for topic-adjacent research.

## Lookup And Listing

Use the same scoping model as sessions:

- Unscoped case-study lookup/list requests mean active root only.
- Parent/root/named/all/layered scope requests use that scope.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Do not merge or renumber across roots.

## Filename

`YYYY-MM-DD-short-slug.md`

Use `references/emit-local-timestamp.md` and the bundled timestamp helper. Put `Date` at the start of the filename and in the frontmatter `date:` field. Use that field verbatim; do not reformat, recompute, or call the clock again for the same case study. Keep the slug descriptive and ASCII-only.

## Frontmatter

```yaml
---
title: Short descriptive title
date: YYYY-MM-DD
topic: area-tag
related-rule: optional/path/to/rule.md
---
```

Omit `related-rule` when no rule exists.

## Body Template

```markdown
# Short Descriptive Title

## Context

What situation triggered the case study.

## What We Tried

Chronological account of the relevant events.

## The Pivot

The moment the diagnosis, decision, or understanding changed.

## Root Cause

The underlying cause or design pressure.

## Fix

What changed, or what should change.

## Rule Extracted

The short reusable rule, if one was extracted.

## What We Learned

The broader lesson and how it should guide future work.
```

Keep case studies narrative and explanatory. Rules are short; case studies explain why the rule exists.

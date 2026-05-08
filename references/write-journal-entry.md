# Write Journal Entry

Use only when the Director explicitly asks for a journal entry or reflective note. Journal entries are not part of the core startup contract.

## Target

Default target is the active root `journal/`. Use `.AgentMemoryRoot/journal/` only when the Director explicitly wants a user-level or cross-project journal entry.

## Lookup And Listing

Use the same scoping model as sessions:

- Unscoped journal lookup/list requests mean active root only.
- Parent/root/named/all/layered scope requests use that scope.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Do not merge or renumber across roots.
- Journal entries are not prompts or task assignments.

## Voice

Journal entries are Director-authored or Director-voiced: first-person, reflective, written for a future reader who was not present.

## Filename

`YYYY-MM-DD-HHMMSS-<local-zone>-director-<descriptive-slug>.md`

Use the user's local time zone. Query the system clock or use trusted host-provided time; do not rely on internal model time. Timestamp-bearing filenames use hours, minutes, and seconds (`HHMMSS`) so forgotten entries can be inserted into the correct day/time sequence.

## Template

```markdown
# Short Title

Project: <project or cross-project>
Phase: <optional>
Date: YYYY-MM-DD
Author: director

<Narrative body in Director voice.>

Key Insight: <one-line takeaway>
```

Do not proactively suggest journaling. Draft it when asked.

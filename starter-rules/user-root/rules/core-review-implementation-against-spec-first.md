---
description: Use for implementation reviews before edge-case brainstorming.
type: behavior
source: director
created: 2026-04-16
---

- Read the spec sections that were implemented.
- Locate and read the implementing code for each required behavior.
- Do not trust implementer summaries or handoff language.
- Flag every spec/code divergence, however small.
- Analyze edge cases and race/error behavior only after the spec pass.

**Why:** Summaries can sound spec-compliant while code is not.

---
description: Use when reviewing a fix whose acceptance criteria require live or runtime behavior evidence.
type: behavior
source: director
created: 2026-08-24
---

- Compare the implementation handoff against the objective's acceptance criteria before approving.
- If the acceptance criteria require live, runtime, Director-visible, or interactive behavior evidence, do not approve from static code inspection, implementer claims, or ordinary automated tests alone.
- Approve only when the handoff shows that the required live/runtime behavior was actually exercised, or when the Director explicitly accepts the missing live check.
- If the required live/runtime check was not exercised and the Director has not explicitly accepted that gap, record a question or block. Name the missing behavior check and the evidence needed to satisfy it.
- A handoff may mention the missing live check as residual risk, but that wording does not satisfy acceptance criteria that require live behavior verification.

**Why:** Review approval should not convert an unmet live-behavior acceptance criterion into a harmless footnote.

**Provenance:** Added from the R113 durable-rule decision after the F-007 review miss, where static code shape and handoff claims were treated as enough even though the acceptance criteria required Director-visible live/runtime behavior.

---
description: Use before patching around duplicate state, redundant fields, or conceptually wrong structure.
type: behavior
source: claude
created: 2026-05-20
---

Before coding around awkward structure, pause and ask whether the structure itself is wrong.

- Look for duplicated state, redundant fields, and patch-around fixes.
- Surface conceptual concerns before editing when structure appears to be the root problem.
- Prefer removing wrong structure over layering fixes on top.

**Why:** Patching around a bad shape hides the design problem and makes later cleanup harder.

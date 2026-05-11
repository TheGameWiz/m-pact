---
description: Challenge added moving parts when a smaller design solves the same problem.
type: behavior
source: director
created: 2026-05-02
---

Favor the simplest solution that fully satisfies the requirement. Complexity must earn its place through correctness, maintainability, performance, or a real constraint.

Simpler does not mean partial. Do not use MVP, future-version, or "later enhancement" framing to defer requested domain behavior unless the Director explicitly asks for staging or accepts a scoped release.

**How to apply:** Before implementing a complex approach, ask whether a smaller change, existing path, direct fix, or deleted abstraction solves the same problem. If so, choose the simpler complete route or explain why it is insufficient.

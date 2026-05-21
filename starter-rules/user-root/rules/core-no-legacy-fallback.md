---
description: Active development assumes disposable test data and one current format.
type: behavior
source: director
created: 2026-04-03
---

- One code path, one current data format.
- Treat mismatched data as damaged, not as a migration requirement.
- The Director deletes test data between iterations; there is no user base to migrate.

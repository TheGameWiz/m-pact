# Repair Task Spec Log

Use when `prepare-handoff`, refresh, or another helper reports `orphanedSpecMembers` for a task.

This is a narrow derived repair path. It creates a task log record for new-format design specification members whose paired log record is missing. Legacy snapshot containers remain readable but are no longer repaired by this helper. Orphan detection compares member filename log numbers with task-log record numbers and reads item frontmatter only when composing the repair body. It does not reconstruct Director intent, rationale, rejected alternatives, checks performed, or handoff context.

Projection failures are not orphans and do not use this helper. A paired log record with no projected members (`projectionStatus: projection-failed-before-members`) and a durable projection missing only its `specification.md` mirror (`projectionStatus: mirror-failed-after-members`) each follow the per-status recovery in `write-design-spec.md`, which owns those semantics.

## Procedure

1. Run `scripts/repair-task-spec-log.js` for the affected task.
2. If the receipt says no orphan was detected, continue normally.
3. If the receipt contains an `announcement`, surface that announcement in your reply. This is required, not optional: a receipt seen only by an agent would make the repair silent from the Director's chair, and the point of the path is to make the gap visible while keeping unattended loops unblocked.

This path announces rather than asks. A fully-derived repair record has nothing for the Director to approve, and asking would block unattended loops on a decision with no content. The record itself is the durable announcement of last resort.

Example:

```bash
node <this-skill>/scripts/repair-task-spec-log.js --task t0005 --project-id 7
```

Do not hand-author a replacement explanation for the orphaned specification member.

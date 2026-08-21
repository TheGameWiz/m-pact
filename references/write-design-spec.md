# Write Design Specification

Use for Director-instructed task design specification writes.

## Authorization

Requires Director instruction. Do not autonomously write design specification members or this helper's paired task logs. Item birth in a plain task log follows `write-task-log.md`'s Director-approval gate. Projection into `specification.zip` still requires Director-instructed `write-design-spec.js`.

## Model

The task definition lives in `task.md`. The authoritative design specification lives in `specification.zip`. New-format tasks also have a helper-maintained plaintext `specification.md` mirror containing the current narrative only.

New-format design specifications use one ZIP container with two member kinds:

- Blob members are named `0000.LLLL-slug.md` and contain all non-item narrative. The current blob is the blob with the highest log record number. If the supplied narrative is byte-identical to the current blob, no new blob is written.
- Item members are named `IIII.LLLL-slug.md`. An item may have multiple members; the current version is the member with the highest `LLLL` for that `IIII` prefix. Item numbers are immutable and are resolved by the member-name prefix, not by container position or slug. Item bodies carry YAML frontmatter with `item`, `source_log_record`, `slug`, and `depends_on`. `source_log_record` is the record that wrote that item version.

Items are born or revised in the paired task log, not declared on the command line. There is no item flag. Every numeric tag in the paired log's `## Active Items` section that does not already have an item member causes one to be written. An existing item writes a new version only when the active-item text begins `REVISION:`.

An active-item line has the form `- [<number>-<slug>] <text>`. The leading digits become the immutable item number. The remainder of the tag, after the first `-`, `.`, or `_`, becomes the member slug. The text after the closing bracket becomes the item body. For revisions, write `- [<number>-<slug>] REVISION: <complete replacement item body>`; the helper strips `REVISION:` before writing the item member.

- `- [7-directory-lock-stale-steal] Mirror the ZIP layer's stale handling.` writes `0007.LLLL-directory-lock-stale-steal.md`.
- `- [7] Mirror the ZIP layer's stale handling.` writes `0007.LLLL-item.md`.

The second form is accepted rather than refused, and the slug `item` is permanent because item members are never renamed or removed. Always carry a meaningful slug in the tag.

`## Cleared` and `## Resolved` entries name item versions using the shared active-item grammar in `write-task-log.md`, which owns the `VERSION NNNN:` semantics and refusals.

Declare item dependencies in the paired log with a `## Dependencies` section:

```markdown
## Dependencies
- [0007-directory-lock-stale-steal] 0002, 0004
```

Each entry is the complete `depends_on` set for that item. An empty or absent entry means no dependencies. The helper applies dependency entries only to item members it writes in the same design-specification call: newly born items, unabsorbed items, or existing items that declare `REVISION:`. To change dependencies for an existing item, declare `REVISION:` for that item and include its dependency entry in the same paired log.

Every invocation writes a paired task log record, even when the narrative is unchanged and no items are added. The paired log is appended first and the helper uses the assigned record number when projecting `specification.zip` members. All members written by that invocation carry the paired log record number in their filename.

The paired log record states the design change; the helper receipt reports `projectionStatus` separately. If projection fails after the log append, the helper must not report ordinary success on the first receipt line. It emits a `PARTIAL: write-design-spec` receipt and exits nonzero.

Projection failure statuses are intentionally distinct. `projection-failed-before-members` means no specification members were written; the log record remains durable, `specification.md` is not advanced, and recovery is to rerun `write-design-spec.js` with the intended narrative and paired log body so a new log record can project new members. `mirror-failed-after-members` means specification members are already durable and only the editable mirror failed to update; do not rerun the same design change as recovery, because the rerun would append another log record and another item version for content already in `specification.zip`. `mirror-failed-no-members` means the only failed write was regeneration of the editable mirror when no ZIP members were needed. There is no machine-replay section in the log record.

`specification.md` is an editable mirror, not a second source of truth. The helper regenerates it after every successful projection, including calls where the narrative is unchanged and no ZIP members are written. Editing `specification.md` and then running `write-design-spec.js --from-spec-file` is the supported authoring path for narrative edits.

Legacy snapshot-format containers remain readable, but have no write path. If a task already has legacy specification members, `write-design-spec.js` refuses rather than mixing formats or migrating.

## Procedure

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Read `task.md`.
3. Read design specification content as needed:
   - For a new-format item, use `scripts/read-member.js --container specification --item <number>`.
   - For assembled narrative plus selected items, use `scripts/read-design-spec.js`.
   - For a legacy container, `read-design-spec.js` returns the latest legacy snapshot.
4. Edit the current narrative; do not regenerate it from scratch when a targeted edit is enough. Edits must be substantive: cosmetic rewording is not a design change and should leave the narrative byte-identical.
5. Write a substantive paired log body for the same helper call, following `write-task-log.md`'s active-item grammar and carry-forward rules. Include `## Dependencies` per the dependency-timing rule above.
6. The paired log's active list must use numeric tags; a non-numeric active tag is refused because it cannot be absorbed into the design specification.
7. Call `scripts/write-design-spec.js` once with exactly one narrative source: `--from-stdin`, `--content-file <helper-scratch-file>`, or `--from-spec-file`. `--from-spec-file` reads the task's `specification.md` mirror. Follow `helper-write-conventions.md` for choosing stdin versus scratch files.
8. Provide the paired log with `--log-body` for short text, or `--log-input <helper-scratch-file>` for multi-paragraph text.

Any agent may write a design specification update when acting on Director intent. Design item births and revisions require Director approval; helper output records author identity rather than enforcing task seats.

When the running provider exposes a transcript/session ID, the helper automatically records it in the task's `Agents.json` after resolving the agent identity. It reads `CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`/`CODEX_SESSION_ID`, or `ANTIGRAVITY_CONVERSATION_ID` as appropriate; agents do not pass a provider-session argument.

Example:

```bash
node <this-skill>/scripts/write-design-spec.js --task t0005 --project-id 7 --agent codex --title "Design update" --log-title "Design decisions" --content-file "<helper-scratch-file>" --log-input "<helper-scratch-file>" --director-intent "Fold approved design decisions into the task design specification."
```

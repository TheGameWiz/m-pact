# Reopen Task

Task reopen is Director-orchestrated only.

Use `scripts/reopen-task.js`. The helper owns the task state update and current-task selection. The folder prefix is authoritative for task state; reopen does not write a `Status:` field to `task.md`.

For tasks closed by the new close-status path, the reopen receipt surfaces `reopenUnfinished` and `reopenClearedUnresolved`. Reopen does not automatically return those items to `## Active Items`; the first task log after reopen must seed the active list deliberately. This obligation is mirrored in `write-task-log.md`.

## Procedure

1. Call `scripts/reopen-task.js` once with direct helper arguments.
2. Reply with one concise user-level sentence, such as `Reopened t0005.` If the receipt reports unfinished or cleared-unresolved item versions, state that those were surfaced and not auto-reactivated. Do not report paths, storage changes, log members, sentinels, or other helper internals unless the Director asks for debugging details.

Example shape:

```bash
node <this-skill>/scripts/reopen-task.js --task t0001 --project-id 7
```

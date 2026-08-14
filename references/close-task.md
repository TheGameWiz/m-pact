# Close Task

Task close is Director-orchestrated only.

Use `scripts/close-task.js`. The helper owns the task state update and current-task cleanup. The folder prefix is authoritative for task state; close does not write a `Status:` field to `task.md`.

When the task has a new-format design specification container, close first absorbs any unabsorbed numeric design items into `specification.zip`, writes a close log record, then closes the task. Close never writes progress/status into item members: item members state what should be true, while close status is an event in the task log and receipt. The close log record enumerates unfinished items and cleared-but-unresolved item versions in `## Close Status`; the receipt reports `closeUnfinished` and `closeClearedUnresolved`.

Close never refuses merely because absorption is impossible. Legacy-format containers and tasks with no design specification container still close, with the skip reason reported by the helper. If absorption fails after writing specification members but before writing their paired log record, the receipt must distinguish that partial write from a clean skip and name the written specification members. Recovery for that partial-write case requires reopening the task first, because `repair-task-spec-log.js` only repairs active tasks.

## Procedure

1. Call `scripts/close-task.js` once with direct helper arguments.
2. Reply with one concise user-level sentence, such as `Closed t0005.` If `closeUnfinished` or `closeClearedUnresolved` is nonzero, mention that close recorded remaining work for reopen. Do not report paths, storage changes, log members, or other helper internals unless the Director asks for debugging details.

Example shape:

```bash
node <this-skill>/scripts/close-task.js --task t0001 --project-id 7
```

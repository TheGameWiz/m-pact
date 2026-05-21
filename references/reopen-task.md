# Reopen Task

Task reopen is Director-orchestrated only.

Use `scripts/reopen-task.js`. The helper owns the task state update and current-task selection.

## Procedure

1. Confirm explicit Director instruction to reopen the task.
2. Read the task folder's `task.md` and verify current status is `Closed`.
3. Call `scripts/reopen-task.js` once with direct helper arguments.
4. Reply with one concise user-level sentence, such as `Reopened t0005.` Do not report paths, storage changes, log members, sentinels, or other helper internals unless the Director asks for debugging details.

Example shape:

```bash
node scripts/reopen-task.js --task t0001
```

Do not reopen a task based only on agent judgment.

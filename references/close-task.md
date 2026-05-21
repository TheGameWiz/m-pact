# Close Task

Task close is Director-orchestrated only.

Use `scripts/close-task.js`. The helper owns the task state update and current-task cleanup.

## Procedure

1. Confirm explicit Director instruction to close the task.
2. Read the task folder's `task.md` and verify current status is `Active`.
3. Call `scripts/close-task.js` once with direct helper arguments.
4. Reply with one concise user-level sentence, such as `Closed t0005.` Do not report paths, storage changes, log members, or other helper internals unless the Director asks for debugging details.

Example shape:

```bash
node scripts/close-task.js --task t0001
```

Do not close a task based only on agent judgment.

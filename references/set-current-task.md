# Set Current Task

Use when the Director explicitly asks to make, set, switch, open, or mark a task as current, or when another approved task procedure creates or reopens a task and says to make it current.

Do not use this merely because a task log, summary, or specification was written. The current-task sentinel is an attention pointer, not a task activity timestamp or log cursor.

## Procedure

1. Identify the target from Director wording or the approved calling procedure.
2. Call `scripts/set-current-task.js` once with direct helper arguments.
3. Reply briefly, e.g. `Current task is t0005.`

Example:

```bash
node scripts/set-current-task.js --root .AgentMemory --task t0001
```

The helper owns target validation and replacement of `current__*` sentinels. Never infer a replacement current task from filesystem timestamps, highest task number, active task count, or folder ordering.

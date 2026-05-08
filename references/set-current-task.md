# Set Current Task

Use when the Director explicitly asks to make, set, switch, open, or mark a task as current, or when another approved task procedure creates or reopens a task and says to make it current.

Do not use this procedure merely because a task log, task summary, or `specification.md` was written. The current-task sentinel is an attention pointer, not a task activity timestamp or log cursor.

## Procedure

1. Identify the target task folder from explicit Director wording or the approved calling procedure.
2. Verify the target task folder exists directly under `tasks/`.
3. Verify the target task folder name starts with `A__`.
4. Delete all files directly under `tasks/` matching `current__*`.
5. Create one zero-byte file named `current__<target-task-folder>` directly under `tasks/`.
6. Do not write content into the sentinel.
7. Report the target task folder and sentinel filename.

## Read Behavior

When resolving the current task for a read operation:

- Zero `current__*` sentinels means no current task.
- One `current__*` sentinel points to the candidate task folder encoded in the filename.
- Multiple `current__*` sentinels means delete all of them and proceed as if there is no current task.
- A sentinel with content should be treated as malformed; clear it to zero bytes only when preserving the same target is still valid and explicitly part of a current-task maintenance operation. Otherwise delete it and proceed as no current task.

Never infer a replacement current task from filesystem timestamps, highest task number, active task count, or task folder ordering.

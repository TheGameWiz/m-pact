# Close Task

Task close is Director-orchestrated only.

## Procedure

1. Confirm explicit Director instruction to close the task.
2. Read the task folder's `task.md` and verify current status is `Active`.
3. Append a closing log entry in `log/` with the closure reason.
4. Rename the task folder prefix from `A__` to `C__`.
5. Update `task.md` header `Status: Active` to `Status: Closed`.
6. If `tasks/current-task.md` points at the closed task, remove the pointer unless the Director explicitly names a valid active replacement current task. Never infer a replacement from other active tasks, and never leave the pointer aimed at a closed folder.
7. Report old path, new path, and log entry path.

Do not close a task based only on agent judgment.

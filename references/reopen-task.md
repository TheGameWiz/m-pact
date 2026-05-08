# Reopen Task

Task reopen is Director-orchestrated only.

## Procedure

1. Confirm explicit Director instruction to reopen the task.
2. Read the task folder's `task.md` and verify current status is `Closed`.
3. Rename the task folder prefix from `C__` to `A__`.
4. Update `task.md` header `Status: Closed` to `Status: Active`.
5. Append a reopen log entry in `log/` with the reopen reason.
6. Update `tasks/current-task.md` to point at the reopened active task.
7. Report old path, new path, and log entry path.

Do not reopen a task based only on agent judgment.

# Set Current Task

Use for explicit current-task pointer replacement, or when another approved task procedure creates or reopens a task and says to make that task current.

Do not use this merely because a task log, summary, or specification was written. The current-task sentinel is an attention pointer, not a task activity timestamp or log cursor.

## Procedure

1. Identify the target from Director wording or the approved calling procedure.
2. Call `scripts/set-current-task.js` once with direct helper arguments.
3. Reply briefly, e.g. `Current task is t0005.`

When selecting a task, the helper automatically records the running provider transcript/session ID in that task's `Agents.json` after resolving the agent identity. It reads `CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`/`CODEX_SESSION_ID`, or `ANTIGRAVITY_CONVERSATION_ID` as appropriate; agents do not pass a provider-session argument. The `--clear` path does not record because no task is selected. Pass `--agent <token>` only for synthetic callers, tests, source-checkout runs, or unrecognized local runtimes where automatic identity is unavailable.

Example:

```bash
node <this-skill>/scripts/set-current-task.js --root .AgentMemory --project-id 7 --task t0001
```

Use the project ID from the latest refresh or successful write receipt. The helper owns target validation, project identity validation, and replacement of `current__*` sentinels. Never infer a replacement current task from filesystem timestamps, highest task number, active task count, or folder ordering.

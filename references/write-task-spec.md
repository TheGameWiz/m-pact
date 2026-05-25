# Write Task Specification

Use when the Director says to write the task spec, update the spec, fold decisions into the spec, or write the next spec/log snapshot.

## Authorization

Requires Director instruction. Do not autonomously write a task specification snapshot.

## Procedure

Use `scripts/write-task-spec.js`. It writes the next full `specification.zip` snapshot and paired `log.zip` entry under one task operation lock.

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Read `task.md` and the current specification with `scripts/read-member.js --container specification --latest` when present.
3. Produce the full replacement specification content. Do not edit an older snapshot.
4. Write a substantive paired log body for the same helper call. It should say why the spec changed, what decisions or requirements changed, what evidence was checked, what risks or open questions remain, and what the next agent should know. Do not write a separate task log merely to compensate for a thin paired log.
5. Call `scripts/write-task-spec.js` once with direct arguments plus the full replacement specification content on stdin. Prefer stdin for the specification body, especially when the spec is large.
6. Provide the paired log with `--log-body` for short text, or `--log-input <OS-temp-file>` for multi-paragraph text created with the provider's file-write capability. Use `--content-file <OS-temp-file>` for the specification only when stdin delivery is not workable.
7. Reply briefly, e.g. `Wrote the t0005 specification and logged the change.`

If stdin body delivery fails, follow the fallback in `helper-write-conventions.md`.

Example:

```bash
"# full replacement spec..." | node scripts/write-task-spec.js --task t0005 --agent codex --title "Spec v2" --log-title "Spec v2 decisions" --log-input "<OS-temp-file>"
```

Do not read prior logs merely to write the paired entry, assign record numbers, update the current-task sentinel, create project/skill scratch input, or fetch timestamps separately.

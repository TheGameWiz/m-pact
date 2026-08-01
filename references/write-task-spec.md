# Write Task Specification

Use when the Director says to write the task spec, update the spec, fold decisions into the spec, or write the next spec/log snapshot.

## Authorization

Requires Director instruction. Do not autonomously write a task specification snapshot.

## Procedure

Use `scripts/write-task-spec.js`. It writes the next full `specification.zip` snapshot and paired `log.zip` entry under one task operation lock.

The specification content is written as supplied. The paired task log uses the same generated wrapper as `write-task-log.js`: YAML frontmatter, `# <log-title>`, and `## Agent Response: <agent>`. Supply only the paired log body that belongs under that generated heading; do not reproduce it. Use `--director-intent` for the Director-framed reason for the spec update, not a restatement of the code change.

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Read `task.md` and the current specification with `scripts/read-member.js --container specification --latest` when present.
3. Produce the full replacement specification content. Do not edit an older snapshot.
4. Write a substantive paired log body for the same helper call. It should say why the spec changed, what decisions or requirements changed, what evidence was checked, what risks or open questions remain, and what the next agent should know. Do not write a separate task log merely to compensate for a thin paired log.
5. Call `scripts/write-task-spec.js` once with direct arguments plus the full replacement specification content on stdin for short shell-simple content, or `--content-file <OS-temp-file>` for complex markdown.
6. Provide the paired log with `--log-body` for short text, or `--log-input <OS-temp-file>` for multi-paragraph text created with the provider's file-write capability. Use `--content-file <OS-temp-file>` for the specification only when stdin delivery is not workable.
7. Reply briefly, e.g. `Wrote the t0005 specification and logged the change.`

For body delivery, follow `helper-write-conventions.md`: use stdin only for short shell-simple text, and use OS-temp input files for long or multi-line markdown.

Example:

```bash
node scripts/write-task-spec.js --task t0005 --project-id 7 --agent codex --title "Spec v2" --log-title "Spec v2 decisions" --content-file "<OS-temp-file>" --log-input "<OS-temp-file>" --director-intent "Fold the approved design decisions into the task spec."
```

Use the project ID from the latest refresh or successful write receipt. Do not read prior logs merely to write the paired entry, assign record numbers, update the current-task sentinel, create project/skill scratch input, or fetch timestamps separately.

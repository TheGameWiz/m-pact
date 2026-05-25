# Helper Write Conventions

Use for helper-owned prose writes: task logs, handoff logs, sessions, journals, task summaries, case studies, rules, task creation handoff bodies, and specification/log paired updates.

Helpers own timestamps, numbering, member names, validation, final formatting, and ZIP writes. The agent supplies the semantic arguments and raw/plain stdin content.

For one-off helper-owned writes:

- Use one helper invocation for each helper-owned artifact.
- Use direct stdin as the normal path for helper prose writes.
- When a helper writes two prose artifacts in one operation, such as a specification plus its paired log, use direct stdin for the primary body and the helper's secondary input option, such as `--log-input <file>`, for a longer secondary body.
- If supplying the body through stdin fails, do not keep trying shell quoting or heredoc variants. Retry once with `--input <file>`.
- Create fallback input files with the provider's built-in file-write capability, not shell heredocs, `echo`, or inline shell strings.
- Put fallback input files in the operating system temp directory. Helpers delete helper-owned input files such as `--input`, `--content-file`, and `--log-input` after reading them when the resolved file path is under the OS temp directory.
- Files passed with `--input` from outside the OS temp directory are treated as reusable user/project artifacts and are not deleted.
- Do not run a separate timestamp command.
- Do not ask an agent to put prose into an intermediate data format.
- Do not manufacture JSON for normal helper writes.

Existing JSON source artifacts may be consumed when the operation is actually about JSON data. Helper receipts are compact text, not JSON.

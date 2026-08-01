# Helper Write Conventions

Use for helper-owned prose writes: task logs, handoff logs, sessions, journals, case studies, rules, task creation handoff bodies, and specification/log paired updates.

Helpers own timestamps, numbering, member names, validation, final formatting, and ZIP writes. The agent supplies the semantic arguments and raw/plain stdin content.

For one-off helper-owned writes:

- Use one helper invocation for each helper-owned artifact.
- Use direct stdin only for short, shell-simple bodies.
- Use `--input <file>` in the operating system temp directory as the normal path for long or multi-line markdown, fenced code, inline code, quotes, dollar signs, or any body that would be fragile in shell quoting.
- When a helper writes two prose artifacts in one operation, such as a specification plus its paired log, use direct stdin for short shell-simple primary content or `--content-file <OS-temp-file>` for complex primary content, and use `--log-input <OS-temp-file>` for a complex paired log body.
- Create helper input files with the provider's built-in file-write capability, not shell heredocs, `echo`, or inline shell strings.
- Helpers delete helper-owned input files such as `--input`, `--content-file`, and `--log-input` after reading them when the resolved real path is under the OS temp directory.
- Files passed with `--input` from outside the OS temp directory are treated as reusable user/project artifacts and are not deleted.
- Flag validation runs before `--input` is read, so a rejected invocation does not consume or delete the temp payload. Fix the flags and retry with the same file when appropriate.
- Do not run a separate timestamp command.
- Do not ask an agent to put prose into an intermediate data format.
- Do not manufacture JSON for normal helper writes.

Existing JSON source artifacts may be consumed when the operation is actually about JSON data. Helper receipts are compact text, not JSON.

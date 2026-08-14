# Helper Write Conventions

Use for helper-owned prose writes: task logs, handoff logs, sessions, journals, case studies, rules, task creation handoff bodies, and specification/log paired updates.

Helpers own timestamps, numbering, member names, validation, final formatting, and ZIP writes. The agent supplies the semantic arguments and raw/plain body content.

For one-off helper-owned writes:

- Use one helper invocation for each helper-owned artifact.
- Use direct stdin only when the helper invocation includes an explicit stdin source flag such as `--from-stdin` and the agent runtime can pass a real input stream without shell-quoting or interpolating the body. Helpers never read fd0 implicitly. In command-only runtimes, do not force long Markdown through heredocs, pipes, inline strings, or shell redirection just to technically use stdin.
- Use a helper scratch file under `.tmp` inside the resolved active memory root as the normal path for long or multi-line markdown, fenced code, inline code, quotes, dollar signs, or any body that would be fragile in shell quoting. With a project root this is `.AgentMemory/.tmp`; with no project root it is `.AgentMemoryRoot/.tmp`.
- Scratch follows the running agent's active root, not a cross-project write destination. A `--cross-project` write still buffers in the active root.
- Name helper scratch payloads with a random, collision-resistant generated filename in the shape `m-pact-input-<32-hex>.md`, `m-pact-content-<32-hex>.md`, or `m-pact-log-<32-hex>.md`.
- When a helper writes two prose artifacts in one operation, such as a specification plus its paired log, use `--from-stdin` with direct stdin only when a real input stream is available, or use `--content-file <helper-scratch-file>` for complex primary content and `--log-input <helper-scratch-file>` for a complex paired log body.
- Create helper input files with the provider's built-in file-write capability, not shell heredocs, `echo`, or inline shell strings.
- Helpers create the scratch directory on demand and maintain its `.gitignore` containing `*`. Agents may also create the directory before staging input when needed.
- Helpers delete helper-owned input files such as `--input`, `--content-file`, and `--log-input` after a successful helper run when the resolved real path is under the active scratch directory and the basename matches the generated helper scratch shape. Helpers also retain the older behavior of deleting consumed OS-temp inputs if one is supplied, but agents should not create new payloads there for normal project work.
- Files passed with `--input` from outside helper-owned scratch roots are treated as reusable user/project artifacts and are not deleted.
- Flag validation runs before `--input` is read, so a rejected invocation does not consume or delete the scratch payload. Refusals or failures after input is read also preserve scratch input files. Fix the cause and retry with the same file when appropriate.
- On successful helper runs, helpers opportunistically prune generated scratch files older than one hour from the active scratch directory. Pruning is non-recursive, matches only generated helper scratch filenames, and never extends to OS temp.
- Do not run a separate timestamp command, for naming scratch files or for the write itself; helpers own timestamps and filesystem metadata is the cleanup marker.
- Do not put prose into an intermediate data format or manufacture JSON for normal helper writes.

A command-only runtime is one whose only write path is the shell; a provider's built-in file-write tool counts as built-in file-write capability even in otherwise command-only runtimes.

Existing JSON source artifacts may be consumed when the operation is actually about JSON data. Helper receipts are compact text, not JSON.

## Structured `--input` sections (create-task / revise-task)

Recognized column-0 sections are only `## Context`, `## Acceptance`, and `## Log`. An unrecognized `## ` heading before `## Log` refuses. A column-0 `## ` heading inside a fenced block is content, not a section boundary. `## Log` is terminal: it captures the rest of the body, section validation stops there, and log-owned headings such as `## Active Items` remain log content. Supplying context or acceptance through both a string flag and a structured section refuses. Whether `## Log` is optional or required is stated by the verb reference (`create-task.md`: optional; `revise-task.md`: required).

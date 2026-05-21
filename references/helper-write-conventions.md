# Helper Write Conventions

Use for helper-owned prose writes: task logs, handoff logs, sessions, journals, task summaries, case studies, rules, task creation handoff bodies, and specification/log paired updates.

Helpers own timestamps, numbering, member names, validation, final formatting, and ZIP writes. The agent supplies the semantic arguments and raw/plain stdin content.

For one-off helper-owned writes:

- Use one helper invocation for each helper-owned artifact.
- Do not spend a separate tool call preparing helper input.
- Do not create scratch input files in temp folders, the project, or the skill folder.
- Do not run a separate timestamp command.
- Do not ask an agent to put prose into an intermediate data format.
- Do not manufacture JSON for normal helper writes.
- Use `--input` only for a Director-provided reusable input file, not for an agent-created throwaway payload.

Existing JSON source artifacts may be consumed when the operation is actually about JSON data. Helper receipts are compact text, not JSON.

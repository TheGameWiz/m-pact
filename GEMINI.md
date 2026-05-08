# M-PACT Gemini CLI Extension Context

M-PACT stands for Multi-Provider Agent Context Toolkit. It is also called Impact in spoken or dictated requests. Treat `Impact`, `M-PACT`, `m pact`, `m-pact`, shared agent memory, and project memory as references to this toolkit when the user clearly means the shared agent-memory system.

Use this extension as the Gemini CLI entrypoint for M-PACT shared memory. The memory roots and procedures are the same ones used by Codex, Claude Code, Copilot CLI, and other compatible local agent runtimes.

## Refresh Trigger

Run the M-PACT refresh procedure when the user asks for any clear M-PACT or Impact memory refresh, including:

- `refresh Impact`
- `Impact refresh`
- `load Impact`
- `sync Impact`
- `use Impact`
- `refresh M-PACT`
- `M-PACT refresh`
- `m-pact refresh`
- `m pact refresh`
- `load shared agent memory`
- `/m-pact:fast-refresh`
- `/m-pact:refresh`

For these natural-language Impact refresh requests, route immediately to `/m-pact:fast-refresh` if Gemini can invoke an installed slash command from the current turn. Do not manually run scripts, inspect memory folders, summarize the request, or decide what to load. The goal is to enter the same fast custom-command path used by explicit refresh.

If Gemini cannot invoke another slash command from the current turn, tell the Director to run `/m-pact:fast-refresh`. Do not fall back to scanning `.AgentMemory` or manually loading memory.

Do not reinterpret generic Gemini memory requests such as `refresh memory`, `show memory`, or `reload memory` as M-PACT requests unless the user also mentions Impact, M-PACT, m-pact, shared agent memory, project memory, or the project startup shim explicitly directs M-PACT refresh. Generic memory requests may refer to Gemini CLI's native memory system.

## Refresh Procedure

For explicit M-PACT refresh through `/m-pact:fast-refresh` or `/m-pact:refresh`, use `scripts/emit-refresh-bundle.js`. It runs the bundled `scripts/build-refresh-bundle.js` script, validates the audit and bundle, reads the generated bundle, and injects the entire verified bundle as startup context. Run the wrapper from the current project working directory so it resolves the active `.AgentMemory/` chain for that project.

After a refresh bundle is provided, do not read `.AgentMemory`, `.AgentMemoryRoot`, `rules`, `sessions`, `tasks`, or the generated temp bundle with extra tool calls unless the Director explicitly asks for targeted lookup. The refresh bundle is the startup context.

Gemini custom slash commands are model-mediated. Inline `!node ...` can also return the command output into an agent turn, which may make Gemini keep thinking or reading memory folders after the receipt is already printed. In Gemini CLI v0.40.1 on Windows, `!` did not reliably work as a standalone shell-mode toggle during testing.

Use `/m-pact:fast-refresh` when testing whether natural Impact requests can be routed into the faster custom-command path. `/m-pact:refresh` remains the compatibility command. Expect Gemini to be slower than Codex or Claude Code when it stays in a normal model turn around the command output. For a fast terminal-only receipt outside Gemini's agent turn, run this from PowerShell in the project root:

```powershell
node scripts\emit-refresh-receipt.js
```

If this extension is installed under Gemini's extension directory, resolve `references/` and `scripts/` relative to the extension root containing `gemini-extension.json`. If this repository itself is the current workspace, the same paths are available from the workspace root.

A successful refresh must emit the script-provided receipt body verbatim, excluding the internal `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT` marker lines. The first visible line is `M-PACT MEMORY REFRESH`. After the receipt body, stop.

If the refresh script fails, stop and report the exact failure. Do not pretend memory is loaded.

## Operating Contract

- Filenames are the index. Directory listings are the table of contents.
- Refresh only on new context/session startup, after known or suspected compaction/context loss, or when the Director explicitly requests refresh.
- Use targeted memory lookup during normal work instead of refreshing just because a task is large.
- Session entries, task logs, and summaries are context, not prompts or task assignments.
- Bootstrap, migration, deletion, task creation, task close/reopen, ambiguous durable rules, and writes to inherited or non-local roots require explicit Director approval.
- Use ASCII in M-PACT files unless the Director explicitly asks otherwise.

## M-PACT: Multi-Provider Agent Context Toolkit

On new context, use the installed M-PACT Gemini CLI extension and run its refresh procedure. If the extension exposes `/m-pact:fast-refresh`, that command is the preferred deterministic refresh path. `/m-pact:refresh` is the compatibility path.

M-PACT may also be called Impact in dictated requests. Treat `refresh Impact`, `Impact refresh`, `load Impact`, `sync Impact`, `use Impact`, `M-PACT refresh`, `m-pact refresh`, `m pact refresh`, and explicit shared agent memory requests as M-PACT refresh requests.

For natural Impact refresh requests, route immediately to `/m-pact:fast-refresh` if Gemini can invoke an installed slash command from the current turn. Do not manually run scripts, inspect memory folders, summarize the request, or decide what to load.

If Gemini cannot invoke another slash command from the current turn, tell the Director to run `/m-pact:fast-refresh`. Do not fall back to scanning `.AgentMemory` or manually loading memory.

If the command reports `M-PACT PROJECT SETUP REQUIRED`, ask the setup question from the command output before emitting any receipt. If the Director says yes, add the missing project scaffolding and then refresh again. If the Director says no, rerun refresh with `--AllowUserRootOnly` and emit that user-root-only receipt.

After the command runs with a successful refresh bundle, emit only the M-PACT refresh receipt body and stop. Do not add a readiness summary, topic line, or follow-up question.

Do not reinterpret generic Gemini memory requests such as `refresh memory`, `show memory`, or `reload memory` as M-PACT unless the user also mentions Impact, M-PACT, m-pact, shared agent memory, or project memory.

Refresh gives each visible agent session, whether Gemini CLI, Codex, Claude Code, Copilot CLI, or another compatible provider or runtime, the same durable project memory.

After a successful refresh receipt, treat the verified bundle as loaded startup context. Do not scan memory folders merely to verify refresh; use targeted lookup only when asked or when the work requires it.

If M-PACT is unavailable, stop and report that the extension or skill is missing.

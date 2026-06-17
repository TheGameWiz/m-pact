## M-PACT: Multi-Provider Agent Context Toolkit

On new context, use the installed M-PACT Gemini CLI extension and run its refresh procedure. If the extension exposes `/m-pact:fast-refresh`, that command is the preferred deterministic refresh path. `/m-pact:refresh` is the compatibility path.

M-PACT may also be called Impact in dictated requests. Treat `refresh Impact`, `Impact refresh`, `load Impact`, `sync Impact`, `use Impact`, `M-PACT refresh`, `m-pact refresh`, `m pact refresh`, and explicit shared agent memory requests as M-PACT refresh requests.

For natural Impact refresh requests, route immediately to `/m-pact:fast-refresh` if Gemini can invoke an installed slash command from the current turn. Do not manually run scripts, inspect memory folders, summarize the request, or decide what to load.

If Gemini cannot invoke another slash command from the current turn, tell the Director to run `/m-pact:fast-refresh`. Do not fall back to scanning `.AgentMemory` or manually loading memory.

The extension owns setup-required handling, bundle verification, compact receipt output, and targeted lookup rules. Do not duplicate the full refresh procedure in this shim.

Do not reinterpret generic Gemini memory requests such as `refresh memory`, `show memory`, or `reload memory` as M-PACT unless the user also mentions Impact, M-PACT, m-pact, shared agent memory, or project memory.

If the environment variable `MPACT_SUPPRESS` is set to a truthy value (for example `1`), the launching environment owns context here: do not invoke M-PACT and do not run its refresh.

If M-PACT is unavailable, stop and report that the extension or skill is missing.

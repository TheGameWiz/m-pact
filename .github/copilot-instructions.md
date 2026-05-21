# M-PACT: Multi-Provider Agent Context Toolkit

When working in this repository with GitHub Copilot CLI or Copilot agent features, use the M-PACT skill when the user asks for M-PACT, Impact, shared agent memory, project memory, or a memory refresh.

M-PACT may also be called Impact in dictated requests. Treat `refresh Impact`, `Impact refresh`, `load Impact`, `sync Impact`, `use Impact`, `M-PACT refresh`, `m-pact refresh`, `m pact refresh`, `refresh memory`, and explicit shared agent memory requests as M-PACT refresh requests.

For Copilot CLI, prefer the installed `/m-pact` or `m-pact` skill when available. Do not use or mention Gemini-only `/m-pact:fast-refresh`; Copilot uses the normal M-PACT skill refresh.

The skill owns repository-root execution, setup-required handling, bundle verification, compact receipt output, and targeted lookup rules. Do not duplicate the full refresh procedure in this shim.

If M-PACT is unavailable, stop and report that the skill is missing.

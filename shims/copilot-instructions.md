# M-PACT: Multi-Provider Agent Context Toolkit

When working in this repository with GitHub Copilot CLI or Copilot agent features, use the M-PACT skill when the user asks for M-PACT, Impact, shared agent memory, project memory, or a memory refresh.

M-PACT may also be called Impact in dictated requests. Treat `refresh Impact`, `Impact refresh`, `load Impact`, `sync Impact`, `use Impact`, `M-PACT refresh`, `m-pact refresh`, `m pact refresh`, `refresh memory`, and explicit shared agent memory requests as M-PACT refresh requests.

For Copilot CLI, prefer the installed `/m-pact` or `m-pact` skill when available. Refresh gives each visible agent session, whether Copilot CLI, Codex, Claude Code, Gemini CLI, or another compatible provider or runtime, the same durable project memory. Do not use or mention Gemini-only `/m-pact:fast-refresh`; Copilot uses the normal M-PACT skill refresh.

When refreshing a repository, run M-PACT from the repository root with Node.js and the invoked M-PACT skill script path. Do not treat the repository's own `scripts\build-refresh-bundle.js` path as a fallback or probe; unrelated repositories often have unrelated `scripts` folders. If refresh produces a manifest, read/apply the `BundlePath`. If it produces `M-PACT PROJECT SETUP REQUIRED`, ask the setup question before any receipt. Do not run refresh by changing directory into `.codex\skills\m-pact`, `.claude\skills\m-pact`, `.copilot\skills\m-pact`, or any other skill install folder. A `project: (none found)` result from a skill install folder is invalid for the repo and must not trigger bootstrap.

If refresh reports `M-PACT PROJECT SETUP REQUIRED`, ask the setup question from the script output before emitting any receipt. If the user says yes, add the missing project scaffolding and then refresh again. If the user says no, rerun refresh with `--AllowUserRootOnly` and emit that user-root-only receipt.

After a successful refresh manifest, read/apply the bundle at `BundlePath`, emit the `M-PACT MEMORY REFRESH` receipt body, and stop. Do not ask whether to open or apply the bundle. After a successful refresh receipt, treat the verified bundle as loaded startup context. Do not scan memory folders merely to verify refresh; use targeted lookup only when asked or when the work requires it.

If M-PACT is unavailable, stop and report that the skill is missing.
